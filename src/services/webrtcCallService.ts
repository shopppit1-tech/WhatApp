import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { clampString } from '../utils/chatHelpers';
import { createRandomId } from '../utils/virtualNumber';
import { db, handleFirestoreError, OperationType } from './firebase';

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export type CallSignalStatus = 'ringing' | 'active' | 'ended' | 'rejected' | 'missed';

export interface CallSessionDoc {
  callId: string;
  callerUid: string;
  calleeUid: string;
  callerVirtualNumber: string;
  calleeVirtualNumber: string;
  callerAlias: string;
  calleeAlias: string;
  participantUids: string[];
  callType: 'audio' | 'video';
  status: CallSignalStatus;
  offerSdp: string;
  answerSdp: string;
  durationSec: number;
  createdAtMs: number;
}

function tsToMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (
    val &&
    typeof val === 'object' &&
    'toMillis' in val &&
    typeof (val as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

const MAX_SDP_FIELD_LENGTH = 16_384;
const COMPRESSED_SDP_PREFIX = 'whatapp:gzip64:';

async function encodeSdpForFirestore(sdp: string): Promise<string> {
  if (sdp.length <= MAX_SDP_FIELD_LENGTH) return sdp;
  if (typeof CompressionStream === 'undefined') {
    throw new Error('Deskripsi panggilan terlalu besar untuk disimpan dengan aman.');
  }
  const compressedStream = new Blob([sdp]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(compressedStream).arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = `${COMPRESSED_SDP_PREFIX}${btoa(binary)}`;
  if (encoded.length > MAX_SDP_FIELD_LENGTH) {
    throw new Error('Deskripsi panggilan melebihi batas ukuran yang didukung.');
  }
  return encoded;
}

async function decodeSdpFromFirestore(value: string): Promise<string> {
  if (!value.startsWith(COMPRESSED_SDP_PREFIX)) return value;
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Perangkat ini belum mendukung pembacaan deskripsi panggilan.');
  }
  const binary = atob(value.slice(COMPRESSED_SDP_PREFIX.length));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const decompressedStream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(decompressedStream).text();
}

export function subscribeMyCallSessions(
  myUid: string,
  onData: (sessions: CallSessionDoc[]) => void
): Unsubscribe {
  const path = 'calls';
  const q = query(
    collection(db, 'calls'),
    where('participantUids', 'array-contains', myUid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      void Promise.all(snapshot.docs.map(async (docSnap): Promise<CallSessionDoc> => {
        const d = docSnap.data();
        return {
          callId: String(d.callId || docSnap.id),
          callerUid: String(d.callerUid || ''),
          calleeUid: String(d.calleeUid || ''),
          callerVirtualNumber: String(d.callerVirtualNumber || ''),
          calleeVirtualNumber: String(d.calleeVirtualNumber || ''),
          callerAlias: String(d.callerAlias || 'Anonim'),
          calleeAlias: String(d.calleeAlias || 'Anonim'),
          participantUids: Array.isArray(d.participantUids) ? d.participantUids.map(String) : [],
          callType: d.callType === 'video' ? 'video' : 'audio',
          status: (d.status as CallSignalStatus) || 'ended',
          offerSdp: await decodeSdpFromFirestore(String(d.offerSdp || '')),
          answerSdp: await decodeSdpFromFirestore(String(d.answerSdp || '')),
          durationSec: typeof d.durationSec === 'number' ? d.durationSec : 0,
          createdAtMs: tsToMs(d.createdAt),
        };
      }))
        .then((list) => {
          list.sort((a, b) => b.createdAtMs - a.createdAtMs);
          onData(list);
        })
        .catch((error) => {
          handleFirestoreError(error, OperationType.LIST, path);
        });
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createCallSession(params: {
  callId: string;
  callerUid: string;
  calleeUid: string;
  callerVirtualNumber: string;
  calleeVirtualNumber: string;
  callerAlias: string;
  calleeAlias: string;
  callType: 'audio' | 'video';
  offerSdp: string;
}): Promise<void> {
  const path = `calls/${params.callId}`;
  try {
    const offerSdp = await encodeSdpForFirestore(params.offerSdp);
    await setDoc(doc(db, 'calls', params.callId), {
      callId: params.callId,
      callerUid: params.callerUid,
      calleeUid: params.calleeUid,
      callerVirtualNumber: clampString(params.callerVirtualNumber, 32),
      calleeVirtualNumber: clampString(params.calleeVirtualNumber, 32),
      callerAlias: clampString(params.callerAlias, 60),
      calleeAlias: clampString(params.calleeAlias, 60),
      participantUids: [params.callerUid, params.calleeUid],
      callType: params.callType,
      status: 'ringing',
      offerSdp,
      answerSdp: '',
      durationSec: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function answerCallSession(callId: string, answerSdp: string): Promise<void> {
  const path = `calls/${callId}`;
  try {
    const storedAnswerSdp = await encodeSdpForFirestore(answerSdp);
    await updateDoc(doc(db, 'calls', callId), {
      answerSdp: storedAnswerSdp,
      status: 'active',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function finishCallSession(
  callId: string,
  status: 'ended' | 'rejected' | 'missed',
  durationSec: number
): Promise<void> {
  const path = `calls/${callId}`;
  try {
    await updateDoc(doc(db, 'calls', callId), {
      status,
      durationSec: Math.max(0, Math.min(86400, Math.floor(durationSec))),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeSingleCall(
  callId: string,
  onChange: (session: CallSessionDoc | null) => void
): Unsubscribe {
  const path = `calls/${callId}`;
  return onSnapshot(
    doc(db, 'calls', callId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      const d = snap.data();
      void Promise.all([
        decodeSdpFromFirestore(String(d.offerSdp || '')),
        decodeSdpFromFirestore(String(d.answerSdp || '')),
      ]).then(([offerSdp, answerSdp]) => onChange({
        callId: String(d.callId || snap.id),
        callerUid: String(d.callerUid || ''),
        calleeUid: String(d.calleeUid || ''),
        callerVirtualNumber: String(d.callerVirtualNumber || ''),
        calleeVirtualNumber: String(d.calleeVirtualNumber || ''),
        callerAlias: String(d.callerAlias || 'Anonim'),
        calleeAlias: String(d.calleeAlias || 'Anonim'),
        participantUids: Array.isArray(d.participantUids) ? d.participantUids.map(String) : [],
        callType: d.callType === 'video' ? 'video' : 'audio',
        status: (d.status as CallSignalStatus) || 'ended',
        offerSdp,
        answerSdp,
        durationSec: typeof d.durationSec === 'number' ? d.durationSec : 0,
        createdAtMs: tsToMs(d.createdAt),
      })).catch((error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function pushIceCandidate(params: {
  callId: string;
  senderUid: string;
  participantUids: string[];
  candidate: RTCIceCandidateInit;
}): Promise<void> {
  if (!params.candidate.candidate) return;
  const candId = createRandomId('ice');
  const path = `calls/${params.callId}/candidates/${candId}`;
  try {
    await setDoc(doc(db, 'calls', params.callId, 'candidates', candId), {
      senderUid: params.senderUid,
      participantUids: params.participantUids,
      candidate: clampString(params.candidate.candidate, 2048),
      sdpMid: clampString(params.candidate.sdpMid || '', 64),
      sdpMLineIndex:
        typeof params.candidate.sdpMLineIndex === 'number'
          ? Math.max(0, Math.min(16, params.candidate.sdpMLineIndex))
          : 0,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeIceCandidates(
  callId: string,
  myUid: string,
  onCandidate: (senderUid: string, candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  const path = `calls/${callId}/candidates`;
  const q = query(
    collection(db, 'calls', callId, 'candidates'),
    where('participantUids', 'array-contains', myUid)
  );
  const seenIds = new Set<string>();
  return onSnapshot(
    q,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && !seenIds.has(change.doc.id)) {
          seenIds.add(change.doc.id);
          const d = change.doc.data();
          onCandidate(String(d.senderUid || ''), {
            candidate: String(d.candidate || ''),
            sdpMid: String(d.sdpMid || ''),
            sdpMLineIndex: typeof d.sdpMLineIndex === 'number' ? d.sdpMLineIndex : 0,
          });
        }
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
