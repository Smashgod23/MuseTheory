import { Link } from 'react-router-dom';
import { Sphere } from '../components/Sphere';

export default function AboutPage() {
  return (
    <div className="section-pad">
      <div className="split">
        <div>
          <div className="eyebrow" style={{ marginBottom: '0.6rem' }}>The story</div>
          <h1 className="display display-lg" style={{ marginBottom: '1.25rem' }}>
            Built from a<br />rehearsal room.
          </h1>
          <p className="lede" style={{ maxWidth: '46ch' }}>
            I watched what happens when a good choir director's voice disappears from daily
            practice. In rehearsal, a skilled director gives the expressive pushback that
            turns correct notes into meaningful music. After rehearsal, that voice goes
            silent. Muse Theory keeps it going.
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Sphere />
        </div>
      </div>

      <div style={{ marginTop: '4rem' }}>
        <div className="feat-grid">
          <article className="feat">
            <div className="feat-num">Mission</div>
            <h3 className="feat-title">Coach the<br />musical layer</h3>
            <p className="feat-body">
              Most tools check pitch and rhythm. Muse Theory listens to phrasing, contrast,
              dynamics, and the second-time difference. The musical layer above technique.
            </p>
          </article>
          <article className="feat">
            <div className="feat-num">Method</div>
            <h3 className="feat-title">Teacher<br />feedback first</h3>
            <p className="feat-body">
              Training data comes from annotated educator suggestions, not scraped internet
              text. The model learns from the people who actually shape singers and players.
            </p>
          </article>
          <article className="feat">
            <div className="feat-num">Maker</div>
            <h3 className="feat-title">High school<br />project</h3>
            <p className="feat-body">
              Built by Pratham Aithal, a student at Rock Hill High School in Frisco, TX.
              Spring Boot, FastAPI, PostgreSQL, S3. Designed to be a teacher's quiet
              partner, not a replacement.
            </p>
          </article>
        </div>
      </div>

      <div className="card-flush" style={{ marginTop: '3rem', textAlign: 'center', padding: '3rem 2rem' }}>
        <h2 className="display display-md" style={{ marginBottom: '0.75rem' }}>
          Try it on your repertoire.
        </h2>
        <p className="lede lede-center" style={{ marginBottom: '1.25rem' }}>
          Save a piece, log practice, and (soon) upload a recording to hear what Muse
          Theory has to say.
        </p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/catalog" className="btn btn-lime">Browse catalog</Link>
          <Link to="/auth?mode=register" className="btn btn-ghost">Create account</Link>
        </div>
      </div>
    </div>
  );
}
