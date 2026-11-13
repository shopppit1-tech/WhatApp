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
      const list: CallSessionDoc[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
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
          offerSdp: String(d.offerSdp || ''),
          answerSdp: String(d.answerSdp || ''),
          durationSec: typeof d.durationSec === 'number' ? d.durationSec : 0,
          createdAtMs: tsToMs(d.createdAt),
        });
      });
      list.sort((a, b) => b.createdAtMs - a.createdAtMs);
      onData(list);
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
      offerSdp: clampString(params.offerSdp, 16384),
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
    await updateDoc(doc(db, 'calls', callId), {
      answerSdp: clampString(answerSdp, 16384),
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
      onChange({
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
        offerSdp: String(d.offerSdp || ''),
        answerSdp: String(d.answerSdp || ''),
        durationSec: typeof d.durationSec === 'number' ? d.durationSec : 0,
        createdAtMs: tsToMs(d.createdAt),
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
