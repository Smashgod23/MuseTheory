import { Link } from 'react-router-dom';
import { Sphere, Spark } from '../components/Sphere';

const MARQUEE_ITEMS = [
  'Vocal & instrumental',
  'Dynamics',
  'Phrasing',
  'Contrast',
  'Tension maps',
  'Repertoire library',
  'Practice tracking',
  'AI coaching',
];

const FEATURES = [
  {
    n: '01',
    title: 'Hear the\nmusical layer',
    body: 'Most practice tools watch pitch and rhythm. Muse Theory listens to the choices above technique — phrasing, contrast, the second-time difference.',
  },
  {
    n: '02',
    title: 'Trained by\nteachers',
    body: 'Suggestions come from annotated educator feedback, not the general internet. The model learns from the people who actually shape singers and players.',
  },
  {
    n: '03',
    title: 'Your repertoire,\nyour pace',
    body: 'Save pieces to a personal library, set goals, log sessions, and watch the coaching evolve with every recording you upload.',
  },
];

export default function LandingPage({ user }) {
  return (
    <>
      <section className="hero">
        <div className="hero-bg-blur" />
        <Sphere />
        <h1 className="display display-xl hero-headline">
          The new way<br />to practice music
        </h1>
        <p className="lede lede-center">
          Muse Theory is an AI coach that hears the expressive layer of a performance and gives
          you specific, timestamped suggestions about dynamics, phrasing, and the choices
          that make music worth listening to.
        </p>
        <div className="hero-actions">
          <Link to={user ? '/catalog' : '/auth?mode=register'} className="btn btn-lime">
            {user ? 'Browse catalog' : 'Get early access'}
          </Link>
          <Link to="/about" className="btn btn-ghost">
            Read the story
          </Link>
        </div>
      </section>

      <div className="marquee">
        <div className="marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i}>
              <Spark inline size={12} />
              {item}
            </span>
          ))}
        </div>
      </div>

      <section className="section-pad">
        <div className="row" style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ maxWidth: '52ch' }}>
            <div className="eyebrow" style={{ marginBottom: '0.6rem' }}>What it does</div>
            <h2 className="display display-lg">
              Coaching that doesn't<br />stop at the door
            </h2>
          </div>
          <p className="lede" style={{ maxWidth: '32ch' }}>
            A skilled director gives you the expressive pushback that turns correct notes into
            meaningful music. Muse Theory keeps that voice going after rehearsal ends.
          </p>
        </div>

        <div className="feat-grid">
          {FEATURES.map((f) => (
            <article key={f.n} className="feat">
              <div className="feat-num">{f.n}</div>
              <h3 className="feat-title" style={{ whiteSpace: 'pre-line' }}>{f.title}</h3>
              <p className="feat-body">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section-pad" style={{ paddingTop: 0 }}>
        <div className="split">
          <div>
            <div className="eyebrow" style={{ marginBottom: '0.6rem' }}>How it works</div>
            <h2 className="display display-lg" style={{ marginBottom: '1.25rem' }}>
              Record. Reflect.<br />Repeat.
            </h2>
            <p className="lede" style={{ maxWidth: '40ch' }}>
              Upload a recording and Muse Theory extracts sixteen expressive features —
              dynamic range, agogic stress, phrase shape, contrast between repeats — then
              maps them against the piece's expressive parameters and returns coaching you
              can act on in your next run.
            </p>
            <div className="row" style={{ marginTop: '1.5rem' }}>
              <Link to={user ? '/library' : '/auth?mode=register'} className="btn btn-ink">
                {user ? 'Open my library' : 'Start a library'}
              </Link>
              <Link to="/catalog" className="btn btn-ghost">
                Browse the catalog
              </Link>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Sphere />
          </div>
        </div>
      </section>

      <section className="section-pad" style={{ paddingTop: 0 }}>
        <div className="card-flush" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2rem', alignItems: 'center' }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: '0.6rem' }}>For students. For teachers.</div>
            <h2 className="display display-md" style={{ marginBottom: '0.75rem' }}>
              Pick your part of the loop.
            </h2>
            <p className="lede">
              Students get a private workspace to track repertoire and goals. Teachers get a
              way to annotate pieces and review what their students are actually practicing.
            </p>
          </div>
          <Link to={user ? '/catalog' : '/auth?mode=register'} className="btn btn-lime">
            {user ? 'Continue' : 'Join early access'}
          </Link>
        </div>
      </section>
    </>
  );
}
