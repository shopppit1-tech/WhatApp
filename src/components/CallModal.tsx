import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Lock,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Video,
} from 'lucide-react';
import type { DirectoryProfile } from '../types/chat';
import {
  answerCallSession,
  createCallSession,
  finishCallSession,
  pushIceCandidate,
  RTC_CONFIG,
  subscribeIceCandidates,
  subscribeSingleCall,
  type CallSessionDoc,
} from '../services/webrtcCallService';
import {
  acquireCallWakeLock,
  dismissCallNotification,
  releaseCallWakeLock,
} from '../utils/callNotifications';
import { formatDurationSec } from '../utils/chatHelpers';
import {
  startIncomingRingtone,
  startOutgoingRingback,
  stopCallAudioAndVibration,
  unlockCallAudio,
} from '../utils/ringtone';
import { createRandomId } from '../utils/virtualNumber';
import { Avatar } from './Avatar';

const RING_TIMEOUT_MS = 45_000;

export interface ActiveCallState {
  mode: 'outgoing' | 'incoming';
  callId: string;
  callType: 'audio' | 'video';
  peer: DirectoryProfile;
  incomingSession?: CallSessionDoc;
  autoAccept?: boolean;
}

interface CallModalProps {
  activeCall: ActiveCallState | null;
  currentUser: DirectoryProfile;
  onClose: () => void;
}

export function CallModal({ activeCall, currentUser, onClose }: CallModalProps) {
  const [statusLabel, setStatusLabel] = useState('Menghubungkan...');
  const [callState, setCallState] = useState<'ringing' | 'connecting' | 'active' | 'ended'>('ringing');
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const iceUnsubRef = useRef<(() => void) | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);
  const activeCallIdRef = useRef<string | null>(null);
  const secondsRef = useRef(0);
  const remoteDescSetRef = useRef(false);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  const activeCallRef = useRef(activeCall);
  activeCallRef.current = activeCall;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    secondsRef.current = seconds;
  }, [seconds]);

  useEffect(() => {
    if (callState !== 'active') return;
    const timer = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callState]);

  const cleanupCallResources = useCallback(() => {
    stopCallAudioAndVibration();
    releaseCallWakeLock().catch(() => {});

    if (ringTimeoutRef.current !== null) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (iceUnsubRef.current) {
      iceUnsubRef.current();
      iceUnsubRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    remoteStreamRef.current = null;
    remoteDescSetRef.current = false;
    pendingCandidatesRef.current = [];
  }, []);

  async function setupPeerConnection(
    callId: string,
    participantUids: string[],
    callType: 'audio' | 'video'
  ): Promise<RTCPeerConnection> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === 'video' ? { facingMode: 'user', width: { ideal: 1280 } } : false,
    });
    localStreamRef.current = stream;

    if (localVideoRef.current && callType === 'video') {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    const remoteStream = new MediaStream();
    remoteStreamRef.current = remoteStream;

    pc.ontrack = (event) => {
      const tracks = event.streams[0]?.getTracks() || [event.track];
      for (const track of tracks) {
        if (!remoteStream.getTracks().some((t) => t.id === track.id)) {
          remoteStream.addTrack(track);
        }
      }
      if (callType === 'video' && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(() => {});
      } else if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        pushIceCandidate({
          callId,
          senderUid: currentUserRef.current.uid,
          participantUids,
          candidate: event.candidate.toJSON(),
        }).catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        stopCallAudioAndVibration();
        setCallState('active');
        setStatusLabel('Terhubung');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatusLabel('Koneksi terputus');
      }
    };

    return pc;
  }

  async function flushPendingCandidates(pc: RTCPeerConnection) {
    while (pendingCandidatesRef.current.length > 0) {
      const cand = pendingCandidatesRef.current.shift();
      if (cand) {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      }
    }
  }

  const handleAcceptIncoming = useCallback(async () => {
    const call = activeCallRef.current;
    if (!call?.incomingSession) return;
    unlockCallAudio();
    stopCallAudioAndVibration();
    dismissCallNotification(call.callId).catch(() => {});

    const session = call.incomingSession;
    setCallState('connecting');
    setStatusLabel('Menghubungkan...');
    setMediaError(null);

    try {
      const pc = await setupPeerConnection(
        session.callId,
        session.participantUids,
        session.callType
      );

      await pc.setRemoteDescription({ type: 'offer', sdp: session.offerSdp });
      remoteDescSetRef.current = true;

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await answerCallSession(session.callId, answer.sdp || '');

      iceUnsubRef.current?.();
      iceUnsubRef.current = subscribeIceCandidates(
        session.callId,
        currentUserRef.current.uid,
        async (senderUid, cand) => {
          if (senderUid === currentUserRef.current.uid || !pcRef.current) return;
          if (remoteDescSetRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          } else {
            pendingCandidatesRef.current.push(cand);
          }
        }
      );

      await flushPendingCandidates(pc);
      setCallState('active');
      setStatusLabel('Terhubung');
    } catch (err) {
      setMediaError(
        err instanceof Error
          ? `Gagal mengakses mikrofon/kamera: ${err.message}`
          : 'Gagal menerima panggilan.'
      );
    }
  }, []);

  // Outgoing call lifecycle
  const activeCallId = activeCall?.callId || null;
  const activeCallMode = activeCall?.mode || null;

  useEffect(() => {
    if (!activeCallId || activeCallMode !== 'outgoing') return;
    const call = activeCallRef.current;
    const me = currentUserRef.current;
    if (!call) return;

    let unsubCall: (() => void) | null = null;
    let cancelled = false;
    const callId = call.callId || createRandomId('call');
    activeCallIdRef.current = callId;

    async function startOutgoing() {
      setCallState('ringing');
      setStatusLabel('Mengakses mikrofon & kamera...');
      setMediaError(null);
      setSeconds(0);
      setMuted(false);
      setVideoOff(false);

      acquireCallWakeLock().catch(() => {});

      try {
        const participants = [me.uid, call!.peer.uid];
        const pc = await setupPeerConnection(callId, participants, call!.callType);
        if (cancelled) {
          cleanupCallResources();
          return;
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await createCallSession({
          callId,
          callerUid: me.uid,
          calleeUid: call!.peer.uid,
          callerVirtualNumber: me.virtualNumber,
          calleeVirtualNumber: call!.peer.virtualNumber,
          callerAlias: me.alias,
          calleeAlias: call!.peer.alias,
          callType: call!.callType,
          offerSdp: offer.sdp || '',
        });

        if (cancelled) {
          cleanupCallResources();
          return;
        }

        setStatusLabel('Memanggil...');
        startOutgoingRingback();

        ringTimeoutRef.current = window.setTimeout(async () => {
          if (cancelled || remoteDescSetRef.current) return;
          stopCallAudioAndVibration();
          setCallState('ended');
          setStatusLabel('Tidak dijawab');
          await finishCallSession(callId, 'missed', 0).catch(() => {});
          cleanupCallResources();
          window.setTimeout(() => onCloseRef.current(), 900);
        }, RING_TIMEOUT_MS);

        iceUnsubRef.current?.();
        iceUnsubRef.current = subscribeIceCandidates(callId, me.uid, async (senderUid, cand) => {
          if (senderUid === me.uid || !pcRef.current) return;
          if (remoteDescSetRef.current) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
          } else {
            pendingCandidatesRef.current.push(cand);
          }
        });

        unsubCall = subscribeSingleCall(callId, async (docData) => {
          if (!docData || cancelled) return;
          if (
            docData.status === 'active' &&
            docData.answerSdp &&
            !remoteDescSetRef.current &&
            pcRef.current
          ) {
            if (ringTimeoutRef.current !== null) {
              window.clearTimeout(ringTimeoutRef.current);
              ringTimeoutRef.current = null;
            }
            stopCallAudioAndVibration();
            remoteDescSetRef.current = true;
            setCallState('active');
            setStatusLabel('Terhubung');
            await pcRef.current.setRemoteDescription({
              type: 'answer',
              sdp: docData.answerSdp,
            });
            await flushPendingCandidates(pcRef.current);
          } else if (
            docData.status === 'rejected' ||
            docData.status === 'ended' ||
            docData.status === 'missed'
          ) {
            setCallState('ended');
            setStatusLabel(
              docData.status === 'rejected' ? 'Panggilan ditolak' : 'Panggilan berakhir'
            );
            cleanupCallResources();
            window.setTimeout(() => onCloseRef.current(), 900);
          }
        });
      } catch (err) {
        stopCallAudioAndVibration();
        setMediaError(
          err instanceof Error
            ? `Izin kamera/mikrofon diperlukan untuk panggilan: ${err.message}`
            : 'Gagal memulai panggilan WebRTC.'
        );
      }
    }

    startOutgoing();

    return () => {
      cancelled = true;
      unsubCall?.();
      cleanupCallResources();
    };
  }, [activeCallId, activeCallMode, cleanupCallResources]);

  // Incoming call lifecycle (ringing sound, vibration, wake lock, remote hangup detection)
  useEffect(() => {
    if (!activeCallId || activeCallMode !== 'incoming') return;
    const call = activeCallRef.current;
    if (!call) return;

    activeCallIdRef.current = activeCallId;
    setCallState('ringing');
    setStatusLabel(
      call.callType === 'video' ? 'Panggilan video masuk...' : 'Panggilan suara masuk...'
    );
    setSeconds(0);
    setMuted(false);
    setVideoOff(false);
    setMediaError(null);

    acquireCallWakeLock().catch(() => {});
    if (!call.autoAccept) {
      startIncomingRingtone();
    }

    const unsubCall = subscribeSingleCall(activeCallId, (docData) => {
      if (!docData) return;
      if (
        docData.status === 'ended' ||
        docData.status === 'missed' ||
        docData.status === 'rejected'
      ) {
        dismissCallNotification(activeCallId).catch(() => {});
        setCallState('ended');
        setStatusLabel('Panggilan berakhir');
        cleanupCallResources();
        window.setTimeout(() => onCloseRef.current(), 700);
      }
    });

    if (call.autoAccept) {
      handleAcceptIncoming();
    }

    return () => {
      unsubCall();
      dismissCallNotification(activeCallId).catch(() => {});
      cleanupCallResources();
    };
  }, [activeCallId, activeCallMode, cleanupCallResources, handleAcceptIncoming]);

  // Auto-accept if notification action triggered while ringing
  useEffect(() => {
    if (
      activeCall?.mode === 'incoming' &&
      activeCall.autoAccept &&
      callState === 'ringing'
    ) {
      handleAcceptIncoming();
    }
  }, [activeCall?.autoAccept, activeCall?.mode, callState, handleAcceptIncoming]);

  async function handleHangUpOrReject() {
    const callId = activeCallIdRef.current;
    const finalStatus =
      activeCallRef.current?.mode === 'incoming' && callState === 'ringing' ? 'rejected' : 'ended';
    cleanupCallResources();
    if (callId) {
      dismissCallNotification(callId).catch(() => {});
      await finishCallSession(callId, finalStatus, secondsRef.current).catch(() => {});
    }
    onCloseRef.current();
  }

  function toggleMute() {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = muted;
      });
    }
    setMuted((m) => !m);
  }

  function toggleCamera() {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => {
        t.enabled = videoOff;
      });
    }
    setVideoOff((v) => !v);
  }

  if (!activeCall) return null;

  const isIncomingRinging = activeCall.mode === 'incoming' && callState === 'ringing';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Panggilan ${activeCall.callType === 'video' ? 'video' : 'suara'} WebRTC`}
      className="fixed inset-0 z-50 bg-[#0B141A]/96 text-white flex flex-col items-center justify-between py-8 px-6"
    >
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Top Info */}
      <div className="flex flex-col items-center text-center z-10">
        <div className="flex items-center gap-1.5 text-xs text-[#00A884] font-medium mb-4">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Terenkripsi end-to-end</span>
        </div>

        <div className="relative flex items-center justify-center">
          {isIncomingRinging && (
            <>
              <span
                aria-hidden="true"
                className="absolute w-28 h-28 rounded-full bg-[#00A884]/25 animate-ping"
              />
              <span
                aria-hidden="true"
                className="absolute w-24 h-24 rounded-full border-2 border-[#00A884]/60 animate-pulse"
              />
            </>
          )}
          <div className="relative">
            <Avatar
              name={activeCall.peer.alias}
              src={activeCall.peer.avatarUrl}
              bg={activeCall.peer.avatarBg}
              size="xl"
            />
          </div>
        </div>

        <h2 className="mt-4 text-2xl font-bold tracking-tight">{activeCall.peer.alias}</h2>
        <p className="mt-1 text-sm font-mono tabular-nums text-white/75">
          {activeCall.peer.virtualNumber}
        </p>
        <p className="mt-2 text-sm font-mono tabular-nums text-[#00A884]">
          {callState === 'active' ? formatDurationSec(seconds) : statusLabel}
        </p>

        {mediaError && (
          <div
            role="alert"
            className="mt-3 max-w-md px-4 py-2.5 rounded-xl bg-red-950/70 border border-red-700 text-xs text-red-200"
          >
            {mediaError}
          </div>
        )}
      </div>

      {/* Video Streams */}
      {activeCall.callType === 'video' && (
        <div className="relative w-full max-w-2xl flex-1 my-4 rounded-2xl overflow-hidden bg-[#182229] border border-white/10 flex items-center justify-center">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {callState !== 'active' && (
              <div className="flex flex-col items-center gap-2 text-xs text-white/70 bg-black/40 px-4 py-2 rounded-xl">
                <Video className="w-5 h-5 text-[#00A884]" aria-hidden="true" />
                <span>Menunggu video lawan bicara...</span>
              </div>
            )}
          </div>

          {/* Local PiP preview */}
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute bottom-3 right-3 w-28 sm:w-36 aspect-video rounded-xl object-cover bg-[#0B141A] border border-white/20 shadow-lg"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-6 z-10">
        {isIncomingRinging ? (
          <>
            <button
              type="button"
              onClick={handleHangUpOrReject}
              aria-label="Tolak panggilan"
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              <PhoneOff className="w-6 h-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleAcceptIncoming}
              aria-label="Terima panggilan"
              className="w-16 h-16 rounded-full bg-[#25D366] hover:bg-[#1EB958] text-[#111B21] flex items-center justify-center shadow-lg animate-bounce transition-transform active:scale-95 cursor-pointer"
            >
              <Phone className="w-6 h-6" aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Nyalakan mikrofon' : 'Bisukan mikrofon'}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                muted ? 'bg-white text-[#111B21]' : 'bg-[#202C33] text-white hover:bg-[#2A3942]'
              }`}
            >
              {muted ? (
                <MicOff className="w-6 h-6" aria-hidden="true" />
              ) : (
                <Mic className="w-6 h-6" aria-hidden="true" />
              )}
            </button>

            {activeCall.callType === 'video' && (
              <button
                type="button"
                onClick={toggleCamera}
                aria-label={videoOff ? 'Nyalakan kamera' : 'Matikan kamera'}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  videoOff
                    ? 'bg-white text-[#111B21]'
                    : 'bg-[#202C33] text-white hover:bg-[#2A3942]'
                }`}
              >
                {videoOff ? (
                  <CameraOff className="w-6 h-6" aria-hidden="true" />
                ) : (
                  <Camera className="w-6 h-6" aria-hidden="true" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleHangUpOrReject}
              aria-label="Akhiri panggilan"
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <PhoneOff className="w-6 h-6" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
