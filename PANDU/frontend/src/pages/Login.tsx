import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { supabase } from '../utils/supabase.js'

function readableAuthError(message: string) {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login credentials')) {
    return 'Wrong email or password. Check your details and try again.'
  }
  if (normalized.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (normalized.includes('email not confirmed')) {
    return 'Please confirm your email address before signing in.'
  }
  if (normalized.includes('password')) {
    return message
  }

  return `Couldn't ${normalized.includes('sign up') ? 'create your account' : 'sign you in'}: ${message}`
}

type CompanionMood = 'welcome' | 'form' | 'secret' | 'playful' | 'thinking' | 'greeting' | 'curious'

function CompanionCharacter({
  mood,
  thinking,
  speech,
  clickReaction,
  greetingCount,
  onInteract,
}: {
  mood: CompanionMood
  thinking: boolean
  speech: { text: string; id: number } | null
  clickReaction: number
  greetingCount: number
  onInteract: () => void
}) {
  return (
    <div className={`companion-panel mood-${mood}${thinking ? ' is-thinking' : ''}`}>
      {speech && (
        <div key={speech.id} className="companion-speech" role="status" aria-live="polite">
          {speech.text}
        </div>
      )}
      <div className="companion-stage">
        <div className="companion-orbit orbit-one" aria-hidden="true" />
        <div className="companion-orbit orbit-two" aria-hidden="true" />
        <span className="companion-sparkle sparkle-one" aria-hidden="true">✦</span>
        <span className="companion-sparkle sparkle-two" aria-hidden="true">✧</span>
        <span className="companion-sparkle sparkle-three" aria-hidden="true">✦</span>
        <button
          className={`companion-character${clickReaction ? ` click-pulse-${clickReaction % 2}` : ''}${greetingCount ? ` greeting-wave-${greetingCount % 2}` : ''}`}
          type="button"
          aria-label="Say hello to the PANDU companion"
          onClick={onInteract}
        >
          <svg
            className="companion-art"
            viewBox="0 0 360 320"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
        <defs>
          <linearGradient id="hair-back" x1="74" y1="30" x2="302" y2="276" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D7D1FF" />
            <stop offset=".48" stopColor="#9695F0" />
            <stop offset="1" stopColor="#536BC1" />
          </linearGradient>
          <linearGradient id="hair-front" x1="115" y1="48" x2="235" y2="188" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ECE5FF" />
            <stop offset=".53" stopColor="#B6B1FF" />
            <stop offset="1" stopColor="#8296E8" />
          </linearGradient>
          <linearGradient id="skin" x1="145" y1="92" x2="222" y2="192" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFF5F0" />
            <stop offset="1" stopColor="#F4D9D8" />
          </linearGradient>
          <linearGradient id="dress" x1="130" y1="220" x2="250" y2="326" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F4F2FF" />
            <stop offset=".52" stopColor="#AABBEF" />
            <stop offset="1" stopColor="#7089D0" />
          </linearGradient>
          <linearGradient id="ribbon" x1="174" y1="215" x2="224" y2="270" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F8EAF5" />
            <stop offset="1" stopColor="#D8D1FF" />
          </linearGradient>
        </defs>

        <path
          d="M92 106C78 59 108 21 164 21c58-19 112 22 107 83 21 44 14 112 34 162-37-4-48-27-54-54l-14 54-142-2c-7-28-14-46-27-62-4 35-20 54-42 61 19-51 8-112 28-157Z"
          fill="url(#hair-back)"
          stroke="#7488D5"
          strokeWidth="2"
        />
        <path d="M107 67c-17 49-6 115 10 172M270 89c13 51 9 101 23 140M84 130c-4 33-3 62-13 88" fill="none" stroke="#E3DFFF" strokeLinecap="round" strokeOpacity=".7" strokeWidth="5" />
        <path d="M144 183h74v57h-74z" fill="url(#skin)" />
        <path d="M109 320c1-52 15-83 48-97l30 20 29-20c36 15 50 46 53 97H109Z" fill="url(#dress)" stroke="#AEBBEA" strokeWidth="2" />
        <path d="m156 225 31 25-18 25-25-37 12-13Zm61 0-30 25 19 25 25-37-14-13Z" fill="#FFF" fillOpacity=".8" />
        <path d="m187 247 22 19-22 26-21-26 21-19Z" fill="url(#ribbon)" stroke="#C1B9F0" strokeWidth="2" />
        <circle cx="187" cy="266" r="5" fill="#988BDE" />

        <g className="companion-arm">
          <path d="M249 234c17 2 29 14 36 29l-14 15c-16-9-27-19-33-34l11-10Z" fill="url(#dress)" stroke="#AEBBEA" strokeWidth="2" />
          <path d="M276 272c3-8 9-13 15-14 2 0 4 2 3 4 4-2 7 1 5 4 4 0 5 4 2 6 3 3 1 6-2 7-6 4-16 1-23-7Z" fill="url(#skin)" stroke="#E5C5C8" strokeWidth="1.5" />
        </g>

        <g className="companion-pose pose-welcome-arms">
          <path d="M151 230c-17-2-32 2-47 12l-27-18c-6-4-12 2-7 8l17 19-16-5c-7-2-10 6-4 10l24 14c9 5 20 2 29-3l43-17-12-20Z" fill="url(#dress)" stroke="#AEBBEA" strokeWidth="2" strokeLinejoin="round" />
          <path d="M231 230c17-2 32 2 47 12l27-18c6-4 12 2 7 8l-17 19 16-5c7-2 10 6 4 10l-24 14c-9 5-20 2-29-3l-43-17 12-20Z" fill="url(#dress)" stroke="#AEBBEA" strokeWidth="2" strokeLinejoin="round" />
        </g>
        <g className="companion-pose pose-wave-arm">
          <path d="M246 235c13-12 23-26 26-43l-7-22c-2-7 6-10 10-4l8 13 1-22c0-7 9-8 10-1l2 20 5-14c3-7 11-3 9 4l-7 29c-4 17-17 34-34 47l-23-7Z" fill="url(#dress)" stroke="#AEBBEA" strokeWidth="2" strokeLinejoin="round" />
        </g>
        <g className="companion-pose pose-thinking-arm">
          <path d="M242 235c-13-8-20-20-21-35l-16-16c-6-5 0-12 6-8l13 8-7-13c-3-7 5-11 9-5l11 15c10 14 18 29 23 48l-18 6Z" fill="url(#dress)" stroke="#AEBBEA" strokeWidth="2" strokeLinejoin="round" />
        </g>
        <g className="companion-pose pose-playful-arm">
          <path d="M245 235c10-15 17-30 16-47l-8-16c-3-7 5-11 10-5l8 10 2-20c1-7 10-7 10 1l-1 20 8-12c4-6 11-1 8 6l-12 25c-8 15-19 29-32 43l-19-5Z" fill="url(#dress)" stroke="#AEBBEA" strokeWidth="2" strokeLinejoin="round" />
        </g>

        <g className="companion-head">
          <path d="M118 91c0-40 27-66 69-66s70 27 70 68l-7 54c-5 37-30 63-63 63s-58-26-63-63l-6-56Z" fill="url(#skin)" stroke="#E9C9D0" strokeWidth="1.5" />
          <path d="M112 108c-9-50 13-84 53-91 46-9 85 17 95 59-13-7-23-19-30-34-12 22-38 37-72 39-12 1-26-1-39-5 2 19-1 35-7 47Z" fill="url(#hair-front)" stroke="#8792DD" strokeWidth="2" />
          <path d="M120 83c-9 34-7 65 0 87-18-15-26-39-23-66 2-17 9-31 19-42l4 21Zm122-8c14 25 19 54 12 82-3 12-9 22-17 31 6-34 2-62-5-84l10-29Z" fill="#9AA5EC" />
          <path d="M121 71c15 13 31 18 48 17 25-1 47-13 66-37-12 29-33 47-61 52-20 4-38 0-54-12l1-20Z" fill="url(#hair-front)" />
          <path d="M117 88c-9 15-13 34-11 56M248 87c9 17 13 36 11 55" fill="none" stroke="#E3DFFF" strokeLinecap="round" strokeWidth="4" />
          <path d="M137 127c7-8 18-10 27-5" fill="none" stroke="#776DAD" strokeLinecap="round" strokeWidth="3" />
          <path d="M209 122c8-5 18-3 24 4" fill="none" stroke="#776DAD" strokeLinecap="round" strokeWidth="3" />

          <g className="companion-blink">
            <path d="M133 143c8-11 23-12 32-1-8 14-23 16-32 1Z" fill="#fff" />
            <path d="M203 142c8-11 23-12 32-1-8 14-23 16-32 1Z" fill="#fff" />
            <g transform="translate(0 0)">
              <ellipse cx="151" cy="143" rx="8" ry="11" fill="#6488D9" />
              <ellipse cx="221" cy="142" rx="8" ry="11" fill="#6488D9" />
              <ellipse cx="152" cy="145" rx="4" ry="7" fill="#354875" />
              <ellipse cx="222" cy="144" rx="4" ry="7" fill="#354875" />
              <circle cx="148" cy="138" r="3.5" fill="#fff" />
              <circle cx="218" cy="137" r="3.5" fill="#fff" />
              <circle cx="155" cy="149" r="1.7" fill="#C5E9FF" />
              <circle cx="225" cy="148" r="1.7" fill="#C5E9FF" />
            </g>
            <path d="M132 143c9-13 25-13 34-1M202 142c9-13 25-13 34-1" fill="none" stroke="#59628A" strokeLinecap="round" strokeWidth="3" />
          </g>

          <ellipse cx="128" cy="163" rx="10" ry="5" fill="#F2A7B3" fillOpacity=".35" />
          <ellipse cx="239" cy="162" rx="10" ry="5" fill="#F2A7B3" fillOpacity=".35" />
          <path d="M178 157c-2 5-2 8 2 9" fill="none" stroke="#D99B9F" strokeLinecap="round" strokeWidth="1.7" />
          <path d="M174 174c8 8 18 8 26-1" fill="none" stroke="#C76E83" strokeLinecap="round" strokeWidth="2.5" />
          <path d="M177 175c6 4 13 4 19 0" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="1.5" />
          <path d="M118 125c-8 12-9 29-3 41M250 121c8 13 8 29 2 41" fill="none" stroke="#D9D5FF" strokeLinecap="round" strokeWidth="3" />
        </g>

        <g className="companion-pose pose-thinking-hand">
          <path d="M214 189c-2-8-1-16 3-20 3-3 6-1 6 3v7c4-7 8-10 11-8 3 2 1 6-2 11l-5 9c-3 5-9 7-14 4l-5-3c-4-3-1-8 3-7l3 1Z" fill="url(#skin)" stroke="#E5C5C8" strokeWidth="1.5" strokeLinejoin="round" />
        </g>
        <g className="companion-pose pose-playful-hand">
          <path d="M270 180c-5-4-8-10-9-17-1-5 5-7 7-2l5 8-1-17c0-5 6-6 7-1l3 17 2-14c1-5 7-4 7 1l-1 15 4-10c2-5 7-2 6 2l-5 16c-2 7-8 11-15 9l-10-2Z" fill="url(#skin)" stroke="#E5C5C8" strokeWidth="1.5" strokeLinejoin="round" />
        </g>

        <path d="M141 298c25 8 59 8 93 0" fill="none" stroke="#fff" strokeLinecap="round" strokeOpacity=".8" strokeWidth="3" />
        </svg>
        </button>
      </div>
      <div className="companion-caption" aria-hidden="true">
        <span className="caption-line" />
        <span>Your companion, always here</span>
        <span className="caption-line" />
      </div>
    </div>
  )
}

export default function Login() {
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [mood, setMood] = useState<CompanionMood>('welcome')
  const [speech, setSpeech] = useState<{ text: string; id: number } | null>(null)
  const [clickStars, setClickStars] = useState<Array<{ id: number; x: number; y: number; style: number }>>([])
  const [clickReaction, setClickReaction] = useState(0)
  const [greetingCount, setGreetingCount] = useState(0)
  const speechTimer = useRef<number | null>(null)
  const speechId = useRef(0)
  const clickStarId = useRef(0)

  useEffect(() => () => {
    if (speechTimer.current !== null) window.clearTimeout(speechTimer.current)
  }, [])

  function showSpeech(text: string, nextMood: CompanionMood) {
    if (speechTimer.current !== null) window.clearTimeout(speechTimer.current)
    speechId.current += 1
    setMood(nextMood)
    setSpeech({ text, id: speechId.current })
    speechTimer.current = window.setTimeout(() => {
      setSpeech(null)
      speechTimer.current = null
    }, 800)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')
    showSpeech('One moment, I’m checking…', 'thinking')
    setLoading(true)

    try {
      if (isCreatingAccount) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setMessage('Check your email for a confirmation link, then come back to sign in.')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
      }
    } catch (authError) {
      const detail = authError instanceof Error ? authError.message : 'An unexpected error occurred.'
      setError(readableAuthError(detail))
    } finally {
      setLoading(false)
    }
  }

  function changeMode(createAccount: boolean) {
    setIsCreatingAccount(createAccount)
    setError('')
    setMessage('')
    if (createAccount) showSpeech("Let's create your space!", 'greeting')
    else showSpeech('Welcome back. I’m right here.', 'welcome')
  }

  function handleCardClick(event: ReactMouseEvent<HTMLElement>) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('input, button, label')) return
    showSpeech('Ready when you are.', 'curious')
  }

  function handlePageClick(event: ReactMouseEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const target = event.target
    const targetBounds = target instanceof Element ? target.getBoundingClientRect() : null
    const clientX = event.clientX || targetBounds?.left + (targetBounds?.width ?? 0) / 2 || bounds.width / 2
    const clientY = event.clientY || targetBounds?.top + (targetBounds?.height ?? 0) / 2 || bounds.height / 2
    const id = ++clickStarId.current

    setClickStars((stars) => [
      ...stars,
      {
        id,
        x: clientX - bounds.left,
        y: clientY - bounds.top,
        style: id % 3,
      },
    ])
    setClickReaction((reaction) => reaction + 1)
  }

  return (
    <main className="app-screen" onClickCapture={handlePageClick}>
      <div className="background-stars" aria-hidden="true" />
      {clickStars.map((star) => (
        <span
          key={star.id}
          className={`click-star click-star-${star.style}`}
          style={{ left: star.x, top: star.y }}
          aria-hidden="true"
          onAnimationEnd={() => setClickStars((stars) => stars.filter(({ id }) => id !== star.id))}
        >
          ✦
        </span>
      ))}
      <div className="login-stage">
        <CompanionCharacter
          mood={mood}
          thinking={loading}
          speech={speech}
          clickReaction={clickReaction}
          greetingCount={greetingCount}
          onInteract={() => {
            setGreetingCount((count) => count + 1)
            showSpeech('Hello! Welcome to PANDU!', 'greeting')
          }}
        />
        <section className="auth-card" aria-labelledby="auth-title" onClick={handleCardClick}>
          <div className="card-glint" aria-hidden="true" />
          <p className="eyebrow">PANDU</p>
          <h1 id="auth-title">{isCreatingAccount ? 'Create your account' : 'Welcome back'}</h1>
          <p className="auth-description">
            {isCreatingAccount
              ? 'A personal space, ready when you are.'
              : 'Sign in to continue to your personal space.'}
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="text-input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onFocus={() => showSpeech("Let's get you signed in!", 'form')}
              placeholder="you@example.com"
              required
              disabled={loading}
            />

            <label className="field-label password-label" htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                className="text-input"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isCreatingAccount ? 'new-password' : 'current-password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onFocus={() => showSpeech('Your secret is safe with you!', 'secret')}
                placeholder="Enter your password"
                minLength={isCreatingAccount ? 6 : undefined}
                required
                disabled={loading}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => {
                  setShowPassword((visible) => !visible)
                  showSpeech('I can see you!', 'playful')
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {error && <p className="error-message" role="alert">{error}</p>}
            {message && <p className="success-message" role="status">{message}</p>}

            <button
              className={`primary-button${loading ? ' is-loading' : ''}`}
              type="submit"
              disabled={loading}
            >
              <span className="button-spinner" aria-hidden="true" />
              <span>
                {loading
                  ? 'Please wait…'
                  : isCreatingAccount
                    ? 'Create account'
                    : 'Sign in'}
              </span>
            </button>
          </form>

          <p className="mode-switch">
            {isCreatingAccount ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => changeMode(!isCreatingAccount)}
              disabled={loading}
            >
              {isCreatingAccount ? 'Sign in' : 'Create account'}
            </button>
          </p>
        </section>
      </div>
    </main>
  )
}
