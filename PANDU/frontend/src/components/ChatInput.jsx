import { useState, useRef } from 'react'
import { transcribeAudio } from '../utils/api'

export default function ChatInput({ onSend, disabled, voiceMode, onToggleVoiceMode }) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const voiceModeRef = useRef(voiceMode)
  voiceModeRef.current = voiceMode

  function handleSubmit(e) {
    e.preventDefault()
    if (!text.trim() || disabled) return
    onSend(text)
    setText('')
  }

  async function toggleVoice() {
    if (listening) {
      recorderRef.current?.stop()
      setListening(false)
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      alert('Audio recording is not supported in this browser. Try Chrome or Edge.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType })
        recorderRef.current = null
        if (!audio.size) return

        setTranscribing(true)
        try {
          const extension = recorder.mimeType.split('/')[1]?.split(';')[0] || 'webm'
          const result = await transcribeAudio(audio, `recording.${extension}`)
          if (result.text) {
            if (voiceModeRef.current) {
              onSend(result.text, { voice: true })
            } else {
              setText((previous) => previous ? `${previous} ${result.text}` : result.text)
            }
          }
        } catch (error) {
          alert(error.message)
        } finally {
          setTranscribing(false)
        }
      }

      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop())
        recorderRef.current = null
        setListening(false)
        alert('Audio recording failed. Please try again.')
      }

      recorder.start()
      recorderRef.current = recorder
      setListening(true)
    } catch (error) {
      alert(error.message || 'Microphone access was denied.')
    }
  }

  return (
    <form className="chat-input-bar" onSubmit={handleSubmit}>
      <button
        type="button"
        className={`voice-mode-btn input-mode-btn ${voiceMode ? 'active' : ''}`}
        onClick={onToggleVoiceMode}
        aria-label={voiceMode ? 'Switch to chat mode' : 'Switch to voice mode'}
        aria-pressed={voiceMode}
      >
        {voiceMode ? 'Voice' : 'Chat'}
      </button>
      <button
        type="button"
        className={`mic-btn ${listening ? 'listening' : ''}`}
        onClick={toggleVoice}
        aria-label={
          transcribing
            ? 'Transcribing audio'
            : listening
              ? 'Stop recording'
              : voiceMode
                ? 'Start voice conversation'
                : 'Transcribe a voice message'
        }
        aria-pressed={listening}
        disabled={disabled || transcribing}
        title={voiceMode ? 'Speak to PANDU' : 'Transcribe speech'}
      >
        {transcribing ? '…' : '🎤'}
      </button>
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Message PANDU..."
        disabled={disabled}
      />
      <button type="submit" className="send-btn" disabled={disabled || !text.trim()}>
        ↑
      </button>
    </form>
  )
}
