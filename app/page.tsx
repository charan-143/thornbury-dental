import Link from "next/link";
import { db } from "@/lib/db";
import { HeroDentalModel } from "@/components/hero-dental-model";

// HeroDentalModel is imported directly rather than through next/dynamic.
//
// It carries "use client", and the App Router already gives every client
// component its own chunk, so the wrapper bought no code splitting. What it did
// buy was a second layer of indirection — a lazy import resolved through .then()
// — that the client reference manifest for this route does not track reliably.
// On any recompile that shifted module ids, rendering this page threw
// "__webpack_modules__[moduleId] is not a function" from inside the server
// render: intermittently, and only just after some other route had compiled.
// ssr: true was the default anyway, so nothing about the rendering changes.

/**
 * Public site.
 *
 * A server component, and deliberately the only route that queries without an
 * authorisation check: it reads clinician profiles, which are public
 * information the practice publishes about itself. No patient table is touched
 * here, which is the property worth preserving if this page grows.
 */

type Clinician = {
  id: string;
  name: string;
  credentials: string;
  specialty: string;
  photo: string | null;
  bio: string | null;
};

const CARE_PATH = [
  ["calendar-check", "Book", "Ring the practice and we will find a time with the clinician you want to see."],
  ["clipboard-text", "Prepare", "You get your preparation notes in writing before the appointment, not at the door."],
  ["first-aid-kit", "Treat", "Allergies and current medicines are checked on screen before anything is prescribed."],
  ["heartbeat", "Recover", "Written aftercare, and a number to call if something changes."],
] as const;

export const dynamic = "force-dynamic";

/**
 * The clinician roster is the only dynamic part of this page. If the database
 * is unreachable, the practice site still has to load: the address, opening
 * hours and telephone number are the things a person in pain actually needs,
 * and none of them come from the database. So a failure here degrades to an
 * empty roster rather than taking down the page.
 */
async function loadClinicians(): Promise<Clinician[]> {
  try {
    return (await db()`
      SELECT id, name, credentials, specialty, photo, bio
      FROM clinicians
      WHERE active AND specialty <> ''
      ORDER BY name
    `) as unknown as Clinician[];
  } catch (error) {
    console.error("clinician roster unavailable:", error instanceof Error ? error.message : "unknown");
    return [];
  }
}

export default async function HomePage() {
  const clinicians = await loadClinicians();
  const [lead, ...rest] = clinicians;

  return (
    <>
      <header className="nav">
        <div className="wrap nav-inner">
          <Link className="brand" href="/">
            <span className="brand-mark"><i className="ph-fill ph-tooth" aria-hidden="true" /></span>
            <span className="brand-name">Thornbury Dental</span>
          </Link>
          <nav className="nav-links" aria-label="Main">
            <a href="#care">Care</a>
            <a href="#team">Clinicians</a>
            <a href="#visit">Visiting us</a>
          </nav>
          <div className="nav-actions">
            <Link className="btn btn-primary btn-cta" href="/signin">Staff sign in</Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <div className="wrap hero-grid">
            <div>
              <h1>Dentistry with the instructions <em>written down</em>.</h1>
              <p className="hero-sub">
                A practice in Portland treating gum disease, root canals and implants.
                To arrange a visit, call <strong>+1 (503) 224-7700</strong>.
              </p>
              <div className="hero-cta">
                <Link className="btn btn-primary" href="/signin">Staff sign in</Link>
              </div>
            </div>

            <div className="hero-stage">
              <HeroDentalModel />
            </div>
          </div>
        </section>

        <section className="section" id="care">
          <div className="wrap">
            <div className="section-head">
              <h2>Four moves, and you always know which one you are in.</h2>
              <p>
                Most dental anxiety is uncertainty about what happens next. We remove that by
                writing it down before, during and after.
              </p>
            </div>
            <div className="pathway">
              {CARE_PATH.map(([glyph, title, body]) => (
                <article className="pathway-step" key={title}>
                  <i className={`ph ph-${glyph}`} aria-hidden="true" />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-soft" id="team">
          <div className="wrap">
            <div className="section-head">
              <h2>Three clinicians, and you see the same one each time.</h2>
              <p>
                Continuity is a clinical safety feature, not a courtesy. Your record follows you,
                but so does the person reading it.
              </p>
            </div>

            {clinicians.length === 0 && (
              <p className="meta" style={{ marginTop: 24 }}>
                The clinician list is unavailable right now. Telephone the practice on
                +1 (503) 224-7700 and we will help.
              </p>
            )}

            <div className="team">
              {lead && (
                <article className="clinician clinician-lead">
                  {lead.photo && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={lead.photo} alt={`Portrait of ${lead.name}.`} width={720} height={576} />
                  )}
                  <div>
                    <h3>{lead.name}</h3>
                    <p className="role">{lead.credentials}. {lead.specialty}.</p>
                    <p>{lead.bio}</p>
                  </div>
                </article>
              )}

              <div className="team-side">
                {rest.map((clinician) => (
                  <article className="clinician clinician-row" key={clinician.id}>
                    {clinician.photo && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={clinician.photo} alt={`Portrait of ${clinician.name}.`} width={240} height={240} />
                    )}
                    <div>
                      <h3>{clinician.name}</h3>
                      <p className="role">{clinician.credentials}. {clinician.specialty}.</p>
                      <p>{clinician.bio}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="visit">
          <div className="wrap">
            <div className="cta-band">
              <div>
                <h2>Two assessment slots are held open every weekday.</h2>
                <p>
                  New patients welcome. If you are in pain today, telephone us and we will see you.
                </p>
              </div>
              <p className="cta-phone">
                <span>Call</span>
                <strong>+1 (503) 224-7700</strong>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap">
          <div className="footer-grid">
            <div>
              <Link className="brand" href="/">
                <span className="brand-mark"><i className="ph-fill ph-tooth" aria-hidden="true" /></span>
                <span className="brand-name">Thornbury Dental</span>
              </Link>
              <p style={{ marginTop: 14, maxWidth: "38ch" }}>
                18 Thornbury Row, Portland, Oregon 97210. Telephone +1 (503) 224-7700.
              </p>
            </div>
            <div>
              <h4>Practice</h4>
              <Link href="/signin">Staff sign in</Link>
              <a href="#team">Clinicians</a>
            </div>
            <div>
              <h4>Opening hours</h4>
              <a href="#visit">Monday to Thursday, 08:00 to 18:00</a>
              <a href="#visit">Friday, 08:00 to 15:30</a>
              <a href="#visit">Saturday, emergencies only</a>
            </div>
          </div>
          <p className="footer-note">
            A demonstration build. Every clinician and clinical record shown here is invented.
            Staff sign-in leads to the clinical workspace; patients have no accounts.
          </p>
        </div>
      </footer>
    </>
  );
}
