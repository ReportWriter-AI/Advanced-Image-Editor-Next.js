import { useState, useRef, useCallback } from 'react';

interface UseSpeechToTextReturn {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  transcript: string;
  error: string | null;
  clearTranscript: () => void;
}

export function useSpeechToText(
  onTranscriptUpdate?: (text: string) => void
): UseSpeechToTextReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef<boolean>(false);

  const clearTranscript = useCallback(() => {
    setTranscript('');
  }, []);

  const sendCompleteRecording = useCallback(async (audioBlob: Blob) => {
    try {
      // Ensure the blob has proper type and create a File with .webm extension
      const file = new File([audioBlob], 'audio.webm', {
        type: 'audio/webm',
        lastModified: Date.now(),
      });

      const formData = new FormData();
      formData.append('audio', file, 'audio.webm');

      const response = await fetch('/api/speech-to-text', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.message || 'Failed to transcribe audio';
        
        // Provide user-friendly error messages
        if (errorMsg.includes('Invalid file format') || errorMsg.includes('Invalid audio format')) {
          throw new Error('Audio format error. Please try recording again.');
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      const newText = data.text || '';

      if (newText.trim()) {
        setTranscript((prev) => {
          return prev ? `${prev} ${newText}` : newText;
        });
        // Only pass the new text to the callback, not the accumulated transcript
        if (onTranscriptUpdate) {
          onTranscriptUpdate(newText);
        }
      }
    } catch (err: any) {
      console.error('Error transcribing audio:', err);
      setError(err.message || 'Failed to transcribe audio');
    }
  }, [onTranscriptUpdate]);

  const startNextRecording = useCallback(async () => {
    if (!isRecordingRef.current || !streamRef.current) {
      return;
    }

    try {
      // Check if MediaRecorder is supported
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        throw new Error('Audio format not supported in this browser');
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // Handle data available events
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop - send complete file and start next recording
      mediaRecorder.onstop = async () => {
        // Send complete recording if there's audio data
        if (audioChunksRef.current.length > 0) {
          const completeBlob = new Blob(audioChunksRef.current, {
            type: 'audio/webm',
          });
          audioChunksRef.current = [];
          
          await sendCompleteRecording(completeBlob);
        }

        // If still recording, start the next recording cycle
        if (isRecordingRef.current && streamRef.current) {
          startNextRecording();
        }
      };

      // Start recording (no timeslice parameter - we'll stop manually)
      mediaRecorder.start();

      // Stop recording after 5.5 seconds to create a complete file and avoid cutting words
      recordingTimeoutRef.current = setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 5500); // 5.5 seconds for complete recordings
    } catch (err: any) {
      console.error('Error in recording cycle:', err);
      setError(err.message || 'Failed to continue recording');
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [sendCompleteRecording]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      // Request microphone access with optimized settings for transcription
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // Disable auto gain control for better clarity
          // Removed sampleRate constraint - let browser use optimal rate for better quality
        },
      });

      streamRef.current = stream;
      isRecordingRef.current = true;
      setIsRecording(true);

      // Start the first recording cycle
      startNextRecording();
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone permission denied. Please allow microphone access.'
          : err.message || 'Failed to start recording'
      );
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  }, [startNextRecording]);

  const stopRecording = useCallback(() => {
    // Set flag to stop recording cycles
    isRecordingRef.current = false;

    // Clear the recording timeout
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }

    // Stop the MediaRecorder (this will trigger onstop and send final recording)
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }

    // Stop all media tracks and release resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    // Clear audio chunks
    audioChunksRef.current = [];

    // Update state
    setIsRecording(false);
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
    transcript,
    error,
    clearTranscript,
  };
}

