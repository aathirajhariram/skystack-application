import React, { Suspense, lazy, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useAuth } from "./auth/AuthContext.jsx";
import RequireAuth from "./auth/RequireAuth.jsx";
import LivePortal from "./live/LivePortal.jsx";
import SubscribeHost, { openSubscribe } from "./subscribe/SubscribeModal.jsx";

const OpsConsole = lazy(() => import("./ops/OpsConsole.jsx")); // staff-only, loaded on demand
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
  Database,
  FileCheck2,
  Layers3,
  LockKeyhole,
  Menu,
  Network,
  PanelTop,
  ShieldCheck,
  Sparkles,
  Workflow,
  X,
  Factory,
  Truck,
  Building2,
  MessageCircle,
  Send,
  Bot,
  LifeBuoy,
  Scale,
  Megaphone,
  Compass,
  Mail,
  MapPin,
  Phone,
  Clock3,
  MoveUpRight,
} from "lucide-react";

// Original SkyStack illustrations live in /public/img, one per topic (see ids used below).
// Illustrations are local files; ids starting with "photo-" are the original photos (home carousel).
const image = (id, w = 1200) =>
  id.startsWith("photo-")
    ? `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`
    : `/img/${id}.svg`;
const IND_KEY = {
  manufacturing: "manufacturing",
  "logistics-and-supply-chain": "logistics",
  construction: "construction",
  "real-estate": "real-estate",
  marketing: "marketing",
  "legal-services": "legal",
};
const STEP_KEY = {
  "data-foundations": "dfn",
  "reporting-and-analytics": "rep",
  "process-automation": "aut",
  "governance-and-quality": "gov",
};

const navItems = [
  ["Home", "/"],
  ["Expertise", "/expertise"],
  ["Products", "/products"],
  ["Delivery", "/delivery"],
  ["Specialists", "/specialists"],
  ["Insights", "/insights"],
  ["Contact", "/contact"],
];

function Logo({ light = false }) {
  return (
    <Link
      to="/"
      className={`brand ${light ? "brand-light" : ""}`}
      aria-label="SkyStack home"
    >
      <span className="brand-mark">
        <Cloud size={22} strokeWidth={2.2} />
        <span />
      </span>
      <span>SkyStack</span>
    </Link>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  React.useEffect(() => setOpen(false), [location.pathname]);
  return (
    <header className="site-header">
      <div className="nav-wrap container">
        <Logo />
        <button
          className="mobile-toggle"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={`main-nav ${open ? "nav-open" : ""}`}>
          {navItems.map(([name, path]) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {name}
            </NavLink>
          ))}
          <button
            type="button"
            className="button button-outline nav-subscribe"
            onClick={() => openSubscribe()}
          >
            Subscribe
          </button>
          <Link to="/login" className="button button-primary nav-login">
            <LockKeyhole size={15} /> Client login
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-main">
          <div className="footer-brand">
            <Logo light />
            <p>
              Make your data work harder.
              <br />
              Make decisions with confidence.
            </p>
          </div>
          <div>
            <div className="footer-label">Explore</div>
            {navItems.slice(0, 4).map(([n, p]) => (
              <Link key={p} to={p}>
                {n}
              </Link>
            ))}
          </div>
          <div>
            <div className="footer-label">Resources</div>
            <Link to="/insights">Insights & perspectives</Link>
            <Link to="/contact">Talk to our team</Link>
            <Link to="/login">Client portal</Link>
          </div>
          <div className="footer-contact">
            <div className="footer-label">Start a conversation</div>
            <a href="mailto:aathiraj.hariram@skystack.global">
              aathiraj.hariram@skystack.global <ArrowUpRight size={14} />
            </a>
            <span>Data clarity starts here.</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} SkyStack. All rights reserved.
          </span>
          <div>
            <Link to="/contact">Privacy & security</Link>
            <button type="button" className="footer-cookie-link" onClick={() => window.dispatchEvent(new Event("skystack:cookies"))}>Cookie settings</button>
            <span>Built for better decisions.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Layout({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}

function Eyebrow({ children, light = false }) {
  return (
    <div className={`eyebrow ${light ? "eyebrow-light" : ""}`}>
      <span className="eyebrow-dot" />
      {children}
    </div>
  );
}
function SectionHeading({
  eyebrow,
  title,
  body,
  center = false,
  light = false,
}) {
  return (
    <div
      className={`section-heading ${center ? "text-center" : ""} ${light ? "text-light" : ""}`}
    >
      {eyebrow && <Eyebrow light={light}>{eyebrow}</Eyebrow>}
      <h2>{title}</h2>
      {body && <p>{body}</p>}
    </div>
  );
}
function CTA({
  title = "Ready to make your data work harder?",
  body = "Let’s talk about what better information could make possible for your business.",
  button = "Discuss your requirements",
}) {
  return (
    <section className="cta-band">
      <div className="cta-orb orb-one" />
      <div className="cta-orb orb-two" />
      <div className="container cta-inner">
        <div>
          <Eyebrow light>Let’s move forward</Eyebrow>
          <h2>{title}</h2>
          <p>{body}</p>
        </div>
        <Link className="button button-white" to="/contact">
          {button}
          <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}

const industries = [
  {
    icon: Factory,
    title: "Manufacturing",
    text: "Bring production, quality and supply data into one reliable operational picture.",
    tags: "Production · Quality · Inventory",
    image: "photo-1567789884554-0b844b597180",
  },
  {
    icon: Truck,
    title: "Logistics & Supply Chain",
    text: "Connect shipments, inventory and delivery performance to reduce uncertainty.",
    tags: "Fleet · Fulfilment · Forecasting",
    image: "photo-1586528116311-ad8dd3c8310d",
  },
  {
    icon: Building2,
    title: "Construction",
    text: "Create a clearer view of projects, costs, resources and site progress.",
    tags: "Project controls · Costs · Reporting",
    image: "photo-1504307651254-35680f356dfd",
  },
  {
    icon: Building2,
    title: "Real Estate",
    text: "Turn property, tenancy and portfolio information into a dependable asset view.",
    tags: "Portfolio · Occupancy · Valuation",
    image: "photo-1486406146926-c627a92ad1ab",
  },
  {
    icon: Megaphone,
    title: "Marketing",
    text: "Unify campaign and customer data to understand performance beyond vanity metrics.",
    tags: "Attribution · Audience · ROI",
    image: "photo-1460925895917-afdab827c52f",
  },
  {
    icon: Scale,
    title: "Legal Services",
    text: "Organise matter, document and operational data with consistency and care.",
    tags: "Matter data · Compliance · Insights",
    image: "photo-1589829545856-d10d557cf95f",
  },
];

const services = [
  {
    icon: Database,
    n: "01",
    title: "Data Foundations",
    text: "Bring fragmented information together with thoughtful modelling, quality controls and clear ownership.",
  },
  {
    icon: BarChart3,
    n: "02",
    title: "Reporting & Analytics",
    text: "Replace spreadsheet sprawl with meaningful metrics, trusted dashboards and decision-ready reporting.",
  },
  {
    icon: Workflow,
    n: "03",
    title: "Process Automation",
    text: "Reduce repetitive work by connecting systems and creating reliable, well-governed workflows.",
  },
  {
    icon: ShieldCheck,
    n: "04",
    title: "Governance & Quality",
    text: "Improve confidence in your information with validation, documentation and practical controls.",
  },
];

function MiniChart() {
  return (
    <div
      className="chart-card"
      aria-label="Illustrative business performance chart"
    >
      <div className="chart-top">
        <div>
          <span className="chart-kicker">Operational overview</span>
          <strong>Performance at a glance</strong>
        </div>
        <span className="chart-period">
          Last 6 months <ChevronDown size={13} />
        </span>
      </div>
      <div className="chart-metrics">
        <div>
          <span>Data quality score</span>
          <strong>
            98.4<span className="metric-unit">%</span>
          </strong>
          <small>
            <span className="up">↗ 4.8%</span> vs previous period
          </small>
        </div>
        <div>
          <span>Reports automated</span>
          <strong>126</strong>
          <small>Across 8 workstreams</small>
        </div>
      </div>
      <svg
        className="line-chart"
        viewBox="0 0 470 142"
        role="img"
        aria-label="Illustrative upward performance trend"
      >
        <defs>
          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2d75a6" stopOpacity=".19" />
            <stop offset="100%" stopColor="#2d75a6" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 52, 84, 116].map((y) => (
          <line
            key={y}
            x1="0"
            x2="470"
            y1={y}
            y2={y}
            stroke="#e8edf2"
            strokeDasharray="3 5"
          />
        ))}
        <path
          d="M0 111 C35 105, 46 87, 78 92 S128 71, 157 78 S206 54, 236 62 S289 39, 319 48 S372 20, 402 30 S443 10,470 12 L470 142 L0 142Z"
          fill="url(#areaFill)"
        />
        <path
          d="M0 111 C35 105, 46 87, 78 92 S128 71, 157 78 S206 54, 236 62 S289 39, 319 48 S372 20, 402 30 S443 10,470 12"
          fill="none"
          stroke="#286f9e"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {[0, 78, 157, 236, 319, 402, 470].map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={[111, 92, 78, 62, 48, 30, 12][i]}
            r="3.5"
            fill="#fff"
            stroke="#286f9e"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="chart-months">
        <span>May</span>
        <span>Jun</span>
        <span>Jul</span>
        <span>Aug</span>
        <span>Sep</span>
        <span>Oct</span>
      </div>
      <div className="chart-foot">
        <span>
          <i className="legend-dot" />
          Data integrity trend
        </span>
        <span className="chart-live">
          <i />
          Illustrative dashboard
        </span>
      </div>
    </div>
  );
}

function Home() {
  const [heroSlide, setHeroSlide] = useState(0);
  React.useEffect(() => {
    const timer = window.setInterval(
      () => setHeroSlide((current) => (current + 1) % 4),
      5200,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <Layout>
      <section className="hero hero-carousel">
        <div className="hero-slides" aria-hidden="true">
          {[
            "photo-1451187580459-43490279c0fa",
            "photo-1518770660439-4636190af475",
            "photo-1551288049-bebda4e38f71",
            "photo-1519389950473-47ba0277781c",
          ].map((id, index) => (
            <div
              key={id}
              className={`hero-slide ${heroSlide === index ? "is-active" : ""}`}
              style={{ backgroundImage: `url(${image(id, 1900)})` }}
            />
          ))}
        </div>
        <div className="hero-dark-overlay" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <Eyebrow light>Data management · Analytics · Automation</Eyebrow>
            <h1>
              Clearer data.
              <br />
              <em>Better Business</em>
              <br />
              Decisions.
            </h1>
            <p className="hero-lede">
              We help organisations organise business information, improve
              reporting and understand performance — so your people can spend
              less time chasing data and more time moving forward.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/contact">
                Discuss your requirements <ArrowRight size={17} />
              </Link>
              <Link className="text-link hero-text-link" to="/expertise">
                Explore our expertise <ArrowDownRight size={16} />
              </Link>
            </div>
            <div className="hero-proof">
              <div className="proof-icons">
                <span>
                  <Database size={16} />
                </span>
                <span>
                  <BarChart3 size={16} />
                </span>
                <span>
                  <Workflow size={16} />
                </span>
              </div>
              <p>From complex information to confident action.</p>
            </div>
          </div>
          <div className="hero-carousel-side">
            <div className="hero-carousel-caption">
              <span className="caption-line" /> A better view of your business
            </div>
            <div
              className="hero-carousel-controls"
              aria-label="Hero image carousel controls"
            >
              {[0, 1, 2, 3].map((index) => (
                <button
                  key={index}
                  className={
                    heroSlide === index ? "carousel-dot active" : "carousel-dot"
                  }
                  aria-label={`Show hero image ${index + 1}`}
                  aria-pressed={heroSlide === index}
                  onClick={() => setHeroSlide(index)}
                />
              ))}
              {/* <span className="carousel-count">0{heroSlide+1} <i/> 04</span> */}
            </div>
            <div className="hero-carousel-note">
              <span className="label-icon">
                <Network size={17} />
              </span>
              <div>
                <strong>One clearer picture</strong>
                <small>Connected. Consistent. Useful.</small>
              </div>
              <ArrowUpRight size={17} />
            </div>
          </div>
        </div>
        <div className="hero-bottom-rule container">
          <span>BUILT AROUND YOUR BUSINESS</span>
          <div />
          <span>DESIGNED FOR CLARITY</span>
          <div />
          <span>MADE TO SCALE WITH YOU</span>
        </div>
      </section>

      <section className="section section-intro">
        <div className="container intro-grid">
          <div>
            <Eyebrow>What we do</Eyebrow>
            <h2>
              Practical data solutions, <em>built around your business.</em>
            </h2>
          </div>
          <div className="intro-right">
            <p>
              Good decisions depend on good information. But data is often
              spread across systems, spreadsheets and teams. SkyStack helps make
              it connected, consistent and genuinely useful.
            </p>
            <Link className="text-link" to="/expertise">
              See how we can help <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section services-section">
        <div className="container">
          <SectionHeading
            eyebrow="Our expertise"
            title="Make the complex feel simple."
            body="The right foundations, tools and processes turn everyday business data into an advantage."
          />
          <div className="service-grid">
            {services.map((s) => (
              <Link
                to={`/expertise/${slugify(s.title)}`}
                className="service-card service-card-link"
                key={s.n}
                aria-label={`Read about ${s.title}`}
              >
                <div className="service-card-top">
                  <span className="service-icon">
                    <s.icon size={21} />
                  </span>
                  <span className="service-number">{s.n}</span>
                </div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
                <span className="round-arrow">
                  <ArrowUpRight size={18} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section industries-section">
        <div className="container">
          <div className="industry-heading">
            <SectionHeading
              eyebrow="Industry understanding"
              title="Your industry has its own data challenges."
              body="We shape our approach around the decisions, workflows and realities that matter in your world."
            />
            <Link className="text-link" to="/expertise">
              Explore all industries <ArrowRight size={16} />
            </Link>
          </div>
          <div className="industry-grid">
            {industries.map((item, i) => (
              <Link
                to={`/industries/${slugify(item.title)}`}
                className="industry-card"
                key={item.title}
              >
                <div
                  className="industry-image"
                  style={{ backgroundImage: `url(${image(item.image, 700)})` }}
                />
                <div className="industry-overlay" />
                <div className="industry-content">
                  <span className="industry-icon">
                    <item.icon size={18} />
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                    <span className="industry-tags">{item.tags}</span>
                  </div>
                  <span className="industry-arrow">
                    <ArrowUpRight size={17} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section approach-section">
        <div className="container approach-grid">
          <div className="approach-copy">
            <Eyebrow>How we work</Eyebrow>
            <h2>
              Clarity is not a deliverable. <em>It’s the way we work.</em>
            </h2>
            <p>
              We start by understanding your people, processes and priorities.
              Then we build a practical path from today’s data challenges to a
              more dependable way of working.
            </p>
            <Link className="button button-outline" to="/delivery">
              Discover our approach <ArrowRight size={17} />
            </Link>
            <div className="approach-note">
              <ShieldCheck size={19} />
              <span>Thoughtful by design. Transparent at every step.</span>
            </div>
          </div>
          <div className="approach-steps">
            {[
              [
                "01",
                "Understand",
                "Get close to the business question before choosing a technical solution.",
              ],
              [
                "02",
                "Structure",
                "Create reliable foundations, clear definitions and fit-for-purpose workflows.",
              ],
              [
                "03",
                "Deliver",
                "Build, validate and integrate solutions with your team involved throughout.",
              ],
              [
                "04",
                "Improve",
                "Measure what matters and refine the solution as your business evolves.",
              ],
            ].map((s) => (
              <div className="approach-step" key={s[0]}>
                <span>{s[0]}</span>
                <div>
                  <h3>{s[1]}</h3>
                  <p>{s[2]}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section product-preview">
        <div className="container product-preview-grid">
          <div className="product-visual">
            <div className="product-window">
              <div className="window-top">
                <div className="window-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>SKYSTACK / INSIGHTS</span>
                <span className="window-status">
                  <i /> Connected
                </span>
              </div>
              <div className="window-body">
                <div className="window-sidebar">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="window-main">
                  <div className="window-title">
                    <span>Business overview</span>
                    <i />
                  </div>
                  <div className="window-stat-grid">
                    <div>
                      <small>Revenue overview</small>
                      <b>€2.48m</b>
                      <span>↗ 12.6%</span>
                    </div>
                    <div>
                      <small>On-time delivery</small>
                      <b>96.8%</b>
                      <span>↗ 3.2%</span>
                    </div>
                    <div>
                      <small>Data completeness</small>
                      <b>98.4%</b>
                      <span>↗ 4.8%</span>
                    </div>
                  </div>
                  <div className="window-chart">
                    <div className="window-chart-head">
                      <b>Performance trend</b>
                      <span>Last 6 months</span>
                    </div>
                    <svg viewBox="0 0 340 100">
                      <path
                        d="M0 82 C30 74,45 65,70 70 S110 45,140 56 S190 30,220 42 S265 20,290 28 S320 7,340 10"
                        fill="none"
                        stroke="#2d75a6"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M0 82 C30 74,45 65,70 70 S110 45,140 56 S190 30,220 42 S265 20,290 28 S320 7,340 10 L340 100 L0 100Z"
                        fill="#2d75a6"
                        opacity=".08"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="product-caption">
              <span className="product-caption-icon">
                <PanelTop size={18} />
              </span>
              <span>
                <strong>One view of what matters</strong>
                <small>Illustrative product experience</small>
              </span>
            </div>
          </div>
          <div className="product-preview-copy">
            <Eyebrow>Products & solutions</Eyebrow>
            <h2>
              Useful tools. <em>Not more noise.</em>
            </h2>
            <p>
              From clear dashboards to dependable data pipelines, we create
              practical solutions that fit your existing systems and the way
              your teams work.
            </p>
            <ul className="check-list">
              <li>
                <Check size={16} /> Decision-ready dashboards and reporting
              </li>
              <li>
                <Check size={16} /> Data preparation and quality workflows
              </li>
              <li>
                <Check size={16} /> Connected processes and automation
              </li>
              <li>
                <Check size={16} /> Documented, maintainable foundations
              </li>
            </ul>
            <Link className="text-link" to="/products">
              Explore products & solutions <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="section insights-section">
        <div className="container">
          <div className="insights-head">
            <SectionHeading
              eyebrow="Ideas & perspectives"
              title="Better questions lead to better data."
              body="Straightforward thinking on data quality, reporting and making change work in practice."
            />
            <Link className="text-link" to="/insights">
              Visit insights <ArrowRight size={16} />
            </Link>
          </div>
          <div className="insight-grid">
            <Link
              to="/insights/why-trustworthy-reporting-starts-long-before-the-dashboard"
              className="insight-card"
            >
              <div
                className="insight-photo"
                style={{
                  backgroundImage: `url(${image("art-trustworthy", 700)})`,
                }}
              />
              <div className="insight-meta">
                <span>DATA FOUNDATIONS</span>
                <span>6 MIN READ</span>
              </div>
              <h3>
                Why trustworthy reporting starts long before the dashboard.
              </h3>
              <span className="insight-read">
                Read perspective <ArrowUpRight size={16} />
              </span>
            </Link>
            <Link
              to="/insights/from-spreadsheet-sprawl-to-a-shared-view-of-performance"
              className="insight-card"
            >
              <div
                className="insight-photo"
                style={{
                  backgroundImage: `url(${image("art-sprawl", 700)})`,
                }}
              />
              <div className="insight-meta">
                <span>ANALYTICS</span>
                <span>5 MIN READ</span>
              </div>
              <h3>From spreadsheet sprawl to a shared view of performance.</h3>
              <span className="insight-read">
                Read perspective <ArrowUpRight size={16} />
              </span>
            </Link>
            <Link
              to="/insights/making-data-improvement-a-team-effort-not-an-it-project"
              className="insight-card"
            >
              <div
                className="insight-photo"
                style={{
                  backgroundImage: `url(${image("art-team", 700)})`,
                }}
              />
              <div className="insight-meta">
                <span>DELIVERY</span>
                <span>4 MIN READ</span>
              </div>
              <h3>Making data improvement a team effort, not an IT project.</h3>
              <span className="insight-read">
                Read perspective <ArrowUpRight size={16} />
              </span>
            </Link>
          </div>
        </div>
      </section>
      <CTA />
    </Layout>
  );
}

function PageHero({ eyebrow, title, emphasis, body, imageId, children }) {
  return (
    <section className="page-hero">
      <div className="container page-hero-grid">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1>
            {title} <em>{emphasis}</em>
          </h1>
          <p>{body}</p>
          {children}
        </div>
        {imageId && (
          <div
            className="page-hero-image"
            style={{ backgroundImage: `url(${image(imageId, 1000)})` }}
          >
            <div className="image-corner-note">
              <span>
                <Sparkles size={16} />
              </span>
              <div>
                <strong>Built around your business</strong>
                <small>Practical. Purposeful. Measurable.</small>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Expertise() {
  return (
    <Layout>
      <PageHero
        eyebrow="Expertise"
        title="Turn your data challenges"
        emphasis="into forward motion."
        body="We bring structure to complex information, make performance easier to understand and help teams build processes they can trust."
        imageId="page-expertise"
      >
        <Link to="/contact" className="button button-primary">
          Talk to a specialist <ArrowRight size={17} />
        </Link>
      </PageHero>
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="What we do"
            title="The foundations behind better decisions."
            body="Our work connects the information, systems and people your business relies on."
          />
          <div className="expertise-list">
            {services.map((s, i) => (
              <Link
                to={`/expertise/${slugify(s.title)}`}
                key={s.n}
                className="expertise-row expertise-row-link"
              >
                <div className="expertise-row-icon">
                  <s.icon size={23} />
                </div>
                <span className="expertise-row-number">{s.n}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                  <div className="expertise-tags">
                    {[
                      ["Data modelling", "Integration", "Quality rules"],
                      ["Dashboards", "KPI frameworks", "Performance reporting"],
                      [
                        "Workflow design",
                        "System connections",
                        "Process efficiency",
                      ],
                      ["Data ownership", "Documentation", "Validation"],
                    ][i].map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </div>
                <ArrowUpRight size={19} />
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section industries-detail">
        <div className="container">
          <SectionHeading
            eyebrow="Industry focus"
            title="Different industries. Different definitions of useful."
            body="We learn how your business operates before shaping the data solution around it."
          />
          <div className="industry-detail-grid">
            {industries.map((item) => (
              <Link
                to={`/industries/${slugify(item.title)}`}
                key={item.title}
                className="industry-detail-card"
              >
                <div
                  className="detail-image"
                  style={{ backgroundImage: `url(${image(item.image, 700)})` }}
                />
                <div className="detail-content">
                  <span className="detail-icon">
                    <item.icon size={19} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                  <small>{item.tags}</small>
                  <span className="detail-link">
                    Explore our approach <ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <CTA />
    </Layout>
  );
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const industryStories = {
  manufacturing: {
    intro:
      "Make production, quality and supply decisions with data that reflects what is really happening on the floor.",
    challenge:
      "Manufacturers often have valuable information spread across ERP, MES, quality systems, spreadsheets and supplier updates. When definitions differ or updates arrive late, teams spend time reconciling reports instead of resolving issues.",
    align:
      "SkyStack connects the operational picture around the decisions your teams make: output, downtime, scrap, quality, stock availability and supplier performance. We begin with your process and terminology, not a generic dashboard template.",
    approach: [
      [
        "Map the flow",
        "Trace how production, inventory, quality and order information moves between teams and systems.",
      ],
      [
        "Build trusted foundations",
        "Standardise identifiers, time windows and metric definitions; add validation checks for missing, late or inconsistent records.",
      ],
      [
        "Make performance visible",
        "Create role-appropriate views for operations, quality, planning and leadership, with drill-downs to the underlying causes.",
      ],
      [
        "Improve continuously",
        "Review exceptions with the people closest to the process and refine the data rules as operations evolve.",
      ],
    ],
    outcomes: [
      "A shared view of output and production performance",
      "Earlier visibility into quality and inventory exceptions",
      "Less manual reconciliation across operational reports",
      "Documented metrics that teams can interpret consistently",
    ],
    image: "ind-manufacturing",
  },
  "logistics-and-supply-chain": {
    intro:
      "Connect shipment, inventory, fleet and fulfilment data to give teams a clearer view of service and flow.",
    challenge:
      "Supply-chain data is often split between transport systems, warehouse tools, customer updates, carrier feeds and spreadsheets. Inconsistent timestamps and status definitions make exceptions hard to spot and root causes hard to prove.",
    align:
      "We align your data around the flow of goods and the questions that matter: where a shipment is, whether a delivery promise is at risk, how inventory is moving and where delays repeatedly occur.",
    approach: [
      [
        "Understand the journey",
        "Map order, warehouse, carrier and delivery events, including hand-offs and the meaning of each status.",
      ],
      [
        "Connect the signals",
        "Bring key records together using consistent shipment, order, location and time references.",
      ],
      [
        "Surface exceptions",
        "Build views for on-time delivery, dwell time, fulfilment, stock risk and recurring delay patterns.",
      ],
      [
        "Turn insight into action",
        "Agree on thresholds and ownership so teams can investigate exceptions before they cascade.",
      ],
    ],
    outcomes: [
      "More consistent service-level reporting",
      "Clearer shipment and inventory visibility",
      "Faster investigation of delivery exceptions",
      "Better evidence for planning and carrier reviews",
    ],
    image: "ind-logistics",
  },
  construction: {
    intro:
      "Bring project, cost, resource and site information into a dependable view of delivery progress.",
    challenge:
      "Construction teams work across schedules, cost plans, site reports, procurement data, subcontractors and change requests. If updates arrive in different formats, project leaders can struggle to see the same picture of progress and risk.",
    align:
      "SkyStack helps structure project information around the controls your teams use: milestones, committed and actual costs, resource availability, change, procurement and site progress. We preserve clear definitions and traceable reporting.",
    approach: [
      [
        "Define project controls",
        "Agree the meaning and ownership of milestones, budgets, variations, progress and risk indicators.",
      ],
      [
        "Bring sources together",
        "Structure project, finance, schedule and site records with consistent project and work-package identifiers.",
      ],
      [
        "Create useful reporting",
        "Provide views for project managers and leadership, with trends and exceptions rather than isolated snapshots.",
      ],
      [
        "Maintain traceability",
        "Document data sources, refresh cadence and assumptions so reported changes can be explained.",
      ],
    ],
    outcomes: [
      "More consistent project performance reporting",
      "Earlier visibility of cost and schedule variance",
      "Clearer links between site updates and management views",
      "Less time preparing recurring status packs",
    ],
    image: "ind-construction",
  },
  "real-estate": {
    intro:
      "Turn fragmented property and tenancy information into a clearer view of assets, occupancy and portfolio performance.",
    challenge:
      "Property data can live across property-management systems, leasing files, finance tools, maintenance records and spreadsheets. Differing property IDs, date conventions and definitions can make portfolio comparisons unreliable.",
    align:
      "We help establish a consistent property-level data model and reporting layer for occupancy, lease events, rent roll, operating costs, maintenance and portfolio KPIs, adapted to the information you actually maintain.",
    approach: [
      [
        "Establish a property view",
        "Align property, unit, lease and tenant references, with clear rules for dates and status.",
      ],
      [
        "Validate the portfolio",
        "Check completeness, duplicates and conflicting values before combining information.",
      ],
      [
        "Build portfolio reporting",
        "Create comparable views for occupancy, lease expiries, income and operational performance.",
      ],
      [
        "Support stewardship",
        "Document metric definitions and source ownership so reporting remains maintainable.",
      ],
    ],
    outcomes: [
      "A more consistent portfolio overview",
      "Clearer visibility into occupancy and lease events",
      "Comparable reporting across properties",
      "Improved confidence in recurring management information",
    ],
    image: "ind-real-estate",
  },
  marketing: {
    intro:
      "Connect campaign, channel and customer data to understand what is contributing to business outcomes.",
    challenge:
      "Campaign reporting can be fragmented across ad platforms, web analytics, CRM and sales systems. Different attribution windows and naming conventions make it easy to compare numbers that do not mean the same thing.",
    align:
      "SkyStack helps standardise campaign taxonomy, connect relevant touchpoints and make measurement assumptions explicit. The goal is not to promise perfect attribution, but to create a more transparent and useful view of performance.",
    approach: [
      [
        "Align measurement",
        "Agree on campaign naming, conversion definitions, attribution windows and the business outcomes to track.",
      ],
      [
        "Prepare the data",
        "Clean campaign metadata and connect channel, web, CRM or sales information where permitted and available.",
      ],
      [
        "Build decision views",
        "Show spend, reach, conversion and downstream outcomes together, with clear caveats and drill-downs.",
      ],
      [
        "Learn and refine",
        "Use consistent reporting to compare campaigns, investigate anomalies and improve future planning.",
      ],
    ],
    outcomes: [
      "More consistent cross-channel reporting",
      "Clearer link between campaign activity and outcomes",
      "Less manual report consolidation",
      "Transparent assumptions behind performance metrics",
    ],
    image: "ind-marketing",
  },
  "legal-services": {
    intro:
      "Create a structured, carefully governed view of matter and operational information without losing sight of confidentiality.",
    challenge:
      "Legal teams may need to report across matter-management tools, time recording, document repositories and finance systems. Sensitive information, inconsistent matter metadata and access boundaries make careless consolidation inappropriate.",
    align:
      "We start with data minimisation, permissions and the intended use of each report. Where approved, we can structure operational metadata for workload, matter status, resourcing and billing analysis without exposing unnecessary confidential content.",
    approach: [
      [
        "Define safe use",
        "Confirm purpose, data sensitivity, access boundaries and which fields are genuinely needed.",
      ],
      [
        "Structure approved metadata",
        "Standardise matter identifiers, statuses, practice areas and reporting periods with careful validation.",
      ],
      [
        "Control access and outputs",
        "Design reporting at appropriate levels and avoid exposing matter details beyond authorised audiences.",
      ],
      [
        "Document governance",
        "Record definitions, refresh routines and ownership so the process can be reviewed and maintained.",
      ],
    ],
    outcomes: [
      "More consistent operational reporting",
      "Clearer workload and matter-status visibility",
      "Reduced manual preparation of management information",
      "A governance-first approach to sensitive data",
    ],
    image: "ind-legal",
  },
};

const expertiseStories = {
  "data-foundations": {
    intro:
      "Reliable analytics begins with data that is understandable, consistent and fit for purpose.",
    image: "exp-data-foundations",
    why: "When information arrives from multiple systems, the same customer, product or KPI can mean different things in different places. Dashboards cannot solve that mismatch on their own.",
    method: [
      [
        "Discover sources and decisions",
        "Identify key systems, owners, recurring reports and the business decisions they support.",
      ],
      [
        "Model the essentials",
        "Define common entities, identifiers, relationships and business terms without overengineering.",
      ],
      [
        "Engineer repeatable pipelines",
        "Create documented ingestion and transformation steps with sensible retries and incremental updates.",
      ],
      [
        "Validate and monitor",
        "Add checks for completeness, uniqueness, freshness and unexpected changes; make failures visible.",
      ],
    ],
    deliverables: [
      "Source and data-flow map",
      "Documented data model and definitions",
      "Repeatable transformation pipeline",
      "Quality checks and operational handover",
    ],
  },
  "reporting-and-analytics": {
    intro:
      "Turn business questions into clear metrics, useful visualisations and decisions people can act on.",
    image: "exp-reporting",
    why: "Reports become confusing when metrics are defined differently, visuals do not match the question or the underlying data cannot be traced. Good analytics combines technical reliability with thoughtful communication.",
    method: [
      [
        "Start with the decision",
        "Clarify the audience, action, decision cadence and questions the report must answer.",
      ],
      [
        "Define meaningful metrics",
        "Agree formulas, time windows, filters and ownership with the people who use them.",
      ],
      [
        "Design the narrative",
        "Use hierarchy, context, comparisons and drill-downs to show what changed and where to investigate.",
      ],
      [
        "Validate with users",
        "Reconcile results against source records, test edge cases and refine the experience through feedback.",
      ],
    ],
    deliverables: [
      "KPI definitions and metric catalogue",
      "Role-based dashboard or report",
      "Reconciliation and acceptance checks",
      "Usage notes and improvement backlog",
    ],
  },
  "process-automation": {
    intro:
      "Make repeatable work more dependable by connecting systems, removing avoidable manual steps and designing for exceptions.",
    image: "exp-automation",
    why: "Automation is most effective when the process is understood first. Automating an unclear workflow can make errors happen faster, so we identify hand-offs, decisions and exceptions before choosing an implementation.",
    method: [
      [
        "Map the current process",
        "Document triggers, inputs, owners, hand-offs, exceptions and pain points.",
      ],
      [
        "Simplify before automating",
        "Remove redundant steps and clarify rules so the automated process has a stable foundation.",
      ],
      [
        "Connect and orchestrate",
        "Use appropriate APIs, scheduled jobs or workflow tools, with secure credentials and clear failure handling.",
      ],
      [
        "Observe and maintain",
        "Log outcomes, alert on failures and document recovery procedures so the workflow is supportable.",
      ],
    ],
    deliverables: [
      "Current and target process map",
      "Automation design and integrations",
      "Exception handling and audit trail",
      "Runbook and ownership model",
    ],
  },
  "governance-and-quality": {
    intro:
      "Build confidence in information with practical standards, clear ownership and quality checks that fit daily work.",
    image: "exp-governance",
    why: "Governance works when people know what a metric means, who owns it, how issues are handled and which data can be used for which purpose. Heavy process without practical value is unlikely to last.",
    method: [
      [
        "Prioritise important data",
        "Identify critical datasets, sensitive fields, business owners and high-impact quality risks.",
      ],
      [
        "Define usable standards",
        "Create practical definitions, validation rules, access principles and issue-severity levels.",
      ],
      [
        "Operationalise controls",
        "Run checks within pipelines and reports, assign issue owners and track resolution.",
      ],
      [
        "Review and improve",
        "Use recurring quality trends and user feedback to adjust rules and responsibilities.",
      ],
    ],
    deliverables: [
      "Data ownership and definition register",
      "Quality rules and monitoring",
      "Issue triage workflow",
      "Governance and access documentation",
    ],
  },
};

function IndustryDetail({ slug }) {
  const item = industries.find((i) => slugify(i.title) === slug);
  const story = industryStories[slug];
  if (!item || !story) return <NotFound />;
  const Icon = item.icon;
  return (
    <Layout>
      <PageHero
        eyebrow={`Industry focus · ${item.title}`}
        title="Data shaped around"
        emphasis="your real-world work."
        body={story.intro}
        imageId={story.image}
      >
        <Link className="button button-primary" to="/contact">
          Discuss your industry <ArrowRight size={17} />
        </Link>
      </PageHero>
      <section className="section">
        <div className="container industry-article-layout">
          <aside className="industry-article-aside">
            <span>INDUSTRY BRIEF</span>
            <strong>{item.title}</strong>
            <p>{item.tags.replaceAll(" · ", " / ")}</p>
            <Link className="text-link" to="/contact">
              Discuss your needs <ArrowRight size={15} />
            </Link>
          </aside>
          <article className="longform-article">
            <p className="longform-lead">{story.challenge}</p>
            <section>
              <h2>Where SkyStack aligns with your business</h2>
              <p>{story.align}</p>
            </section>
            <section>
              <h2>How we approach the work</h2>
              <p>
                We begin by learning how work actually moves through your
                organisation: which systems hold the information, where teams
                rely on manual steps, what exceptions occur and which decisions
                need to improve. Together, we prioritise a practical first use
                case and agree how success will be measured.
              </p>
            </section>
            {story.approach.map((step, i) =>
              i < 2 ? (
                <section
                  className={`longform-feature ${i % 2 === 1 ? "feature-reverse" : ""}`}
                  key={step[0]}
                >
                  <div
                    className="longform-feature-image"
                    style={{
                      backgroundImage: `url(${image(`${i === 0 ? "ind" : "dash"}-${IND_KEY[slug]}`)})`,
                    }}
                    role="img"
                    aria-label={step[0]}
                  />
                  <div className="longform-feature-copy">
                    <span className="longform-kicker">OUR APPROACH</span>
                    <h2>{step[0]}</h2>
                    <p>{step[1]}</p>
                  </div>
                </section>
              ) : (
                <section className="longform-text-section" key={step[0]}>
                  <h2>{step[0]}</h2>
                  <p>{step[1]}</p>
                </section>
              ),
            )}
            <section>
              <h2>What better data can make possible</h2>
              <p>
                We agree the outcomes with your team, validate results against
                source information and document the assumptions behind the work.
                Depending on your starting point, the goal may be more
                consistent reporting, earlier visibility of exceptions, less
                repeated manual preparation or a clearer view of operational
                performance.
              </p>
              <ul className="longform-list">
                {story.outcomes.map((x) => (
                  <li key={x}>
                    <Check size={17} />
                    {x}
                  </li>
                ))}
              </ul>
            </section>
            <p className="longform-note">
              The right solution depends on your systems, data maturity,
              security needs and operating model. SkyStack scopes
              recommendations with you rather than assuming one template fits
              every organisation.
            </p>
          </article>
        </div>
      </section>
      <CTA
        title={`Let's explore data opportunities in ${item.title.toLowerCase()}.`}
        body="Tell us how your teams work today and where better information could make a difference."
        button="Talk to SkyStack"
      />
    </Layout>
  );
}

function ExpertiseDetail({ slug }) {
  const service = services.find((s) => slugify(s.title) === slug);
  const story = expertiseStories[slug];
  if (!service || !story) return <NotFound />;
  return (
    <Layout>
      <PageHero
        eyebrow={`SkyStack expertise · ${service.title}`}
        title="Make the complex"
        emphasis="clear and useful."
        body={story.intro}
        imageId={story.image}
      >
        <Link className="button button-primary" to="/contact">
          Discuss this capability <ArrowRight size={17} />
        </Link>
      </PageHero>
      <section className="section">
        <div className="container expertise-article-layout">
          <aside className="industry-article-aside">
            <span>CAPABILITY NOTE</span>
            <strong>{service.title}</strong>
            <p>Data engineering · Analysis · Delivery</p>
            <Link className="text-link" to="/contact">
              Talk to a specialist <ArrowRight size={15} />
            </Link>
          </aside>
          <article className="longform-article">
            <p className="longform-lead">{story.why}</p>
            <section>
              <h2>Start with the business question</h2>
              <p>
                We work backwards from the decision, workflow or customer need
                the capability should support. That gives the work a clear
                purpose and helps avoid building technology that adds complexity
                without solving the underlying problem.
              </p>
            </section>
            <section>
              <h2>How we achieve it</h2>
              <p>
                We assess the current process, data sources, constraints and
                desired outcomes with the people closest to the work. Then we
                define a manageable first delivery, validate it with real
                examples and build in the checks, documentation and ownership
                needed to sustain it.
              </p>
            </section>
            {story.method.map((step, i) => (
              <section
                className={`longform-feature ${i % 2 === 1 ? "feature-reverse" : ""}`}
                key={step[0]}
              >
                <div
                  className="longform-feature-image"
                  style={{
                    backgroundImage: `url(${image(`step-${STEP_KEY[slug]}-${i % 4}`)})`,
                  }}
                  role="img"
                  aria-label={step[0]}
                />
                <div className="longform-feature-copy">
                  <span className="longform-kicker">
                    HOW WE WORK · {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2>{step[0]}</h2>
                  <p>{step[1]}</p>
                </div>
              </section>
            ))}
            <section>
              <h2>What we aim to leave behind</h2>
              <p>
                A successful delivery should be understandable and maintainable
                after handover. We document the important decisions and make the
                operational expectations clear so your team can trust the result
                and know how to improve it.
              </p>
              <ul className="longform-list">
                {story.deliverables.map((x) => (
                  <li key={x}>
                    <Check size={17} />
                    {x}
                  </li>
                ))}
              </ul>
            </section>
            <p className="longform-note">
              Tooling is selected to fit the context rather than dictate it. We
              consider your existing platforms, data volumes, security
              requirements and in-house skills before recommending an
              implementation.
            </p>
          </article>
        </div>
      </section>
      <CTA
        title={`Need help with ${service.title.toLowerCase()}?`}
        body="We can start with a focused conversation about your current process, data sources and goals."
        button="Talk to a specialist"
      />
    </Layout>
  );
}

const fullArticles = [
  {
    slug: "why-trustworthy-reporting-starts-long-before-the-dashboard",
    cat: "Data foundations",
    time: "6 min read",
    title: "Why trustworthy reporting starts long before the dashboard",
    image: "art-trustworthy",
    intro:
      "A polished dashboard cannot repair inconsistent definitions, missing records or unclear ownership. Trust is built upstream, in the everyday engineering decisions that make information dependable.",
    sections: [
      [
        "Begin with the decision",
        "Before selecting charts or tools, ask what decision the report is intended to support, who will use it and how often. This helps separate essential information from data that is merely available.",
      ],
      [
        "Agree what the numbers mean",
        "Revenue, active customer, on-time delivery and other familiar terms can have different definitions across teams. Record the formula, time window, exclusions and accountable owner so people compare like with like.",
      ],
      [
        "Build repeatable preparation",
        "Document how source records are collected, cleaned, joined and transformed. Prefer repeatable pipelines over manual steps that are difficult to reproduce or explain.",
      ],
      [
        "Make quality visible",
        "Check freshness, completeness, uniqueness and valid relationships. When a check fails, surface the issue with enough context for someone to investigate rather than quietly publishing a misleading number.",
      ],
      [
        "Design the dashboard last",
        "Once the data and metrics are understood, choose visuals that make the answer clear. Include context, comparisons and a path to investigate exceptions. A dashboard is the final expression of a trusted process, not a substitute for one.",
      ],
    ],
    takeaway:
      "Start with one high-value report. Trace its most important metrics back to the source, document the definitions, add two or three meaningful quality checks and agree who responds when something fails.",
  },
  {
    slug: "from-spreadsheet-sprawl-to-a-shared-view-of-performance",
    cat: "Analytics",
    time: "5 min read",
    title: "From spreadsheet sprawl to a shared view of performance",
    image: "art-sprawl",
    intro:
      "Multiple spreadsheets often begin as a practical solution. Over time, copies, local formulas and different refresh dates can create competing versions of the truth. The answer is usually not to ban spreadsheets overnight, but to make shared reporting more dependable.",
    sections: [
      [
        "Find where versions diverge",
        "Choose a recurring management question and compare how different teams currently calculate the answer. Look for different filters, date ranges, manual adjustments and source extracts.",
      ],
      [
        "Create a small metric contract",
        "For each important measure, document its business meaning, formula, source, refresh frequency and owner. Keep the first version focused on metrics people actually use.",
      ],
      [
        "Separate preparation from presentation",
        "Create a repeatable, tested preparation step so each report does not independently clean and calculate the same data. This reduces duplicated effort and makes changes easier to review.",
      ],
      [
        "Reconcile before retiring reports",
        "Run the new view alongside the existing spreadsheet, explain differences and involve the people who know the process. Only replace the old workflow when the results are understood and accepted.",
      ],
      [
        "Give teams a route to questions",
        "A shared dashboard should make it easy to see when data was refreshed, what a metric means and who to contact about an issue. Trust depends on transparency as much as design.",
      ],
    ],
    takeaway:
      "Choose one report that causes recurring debate. Align its definitions, automate its preparation and validate it with users before expanding the approach to other reports.",
  },
  {
    slug: "making-data-improvement-a-team-effort-not-an-it-project",
    cat: "Delivery",
    time: "4 min read",
    title: "Making data improvement a team effort, not an IT project",
    image: "art-team",
    intro:
      "Data work succeeds when technical quality and business context meet. Engineers can make pipelines reliable, but the people using the information understand the decisions, exceptions and terminology that make the result useful.",
    sections: [
      [
        "Name the business outcome",
        "Frame the work around a decision or process that needs to improve, rather than a tool to deploy. Agree how the team will recognise progress.",
      ],
      [
        "Bring the right people in early",
        "Include a business owner, the people who prepare or interpret the data, and technical contributors. They each see different failure modes and practical constraints.",
      ],
      [
        "Deliver in small, testable increments",
        "Start with one source, one process or one high-value metric. Show working results early, check them against real examples and use feedback to refine the design.",
      ],
      [
        "Make ownership explicit",
        "Decide who owns definitions, who resolves source-data issues, who monitors pipelines and who approves changes. Without clear ownership, even well-built solutions decay.",
      ],
      [
        "Leave knowledge behind",
        "Document assumptions, data flows, operational checks and recovery steps. A good handover makes the solution easier to maintain and improves the team’s ability to ask better questions.",
      ],
    ],
    takeaway:
      "Treat the first delivery as a shared learning loop: agree one outcome, build a small reliable slice, validate it with users and decide together what to improve next.",
  },
  {
    slug: "data-governance-that-helps-work-move-forward",
    cat: "Governance",
    time: "7 min read",
    title: "Data governance that helps work move forward",
    image: "art-flow",
    intro:
      "Governance is most useful when it helps people make consistent, safe decisions without adding unnecessary friction. It should make ownership, definitions and appropriate use easier to understand.",
    sections: [
      [
        "Focus on critical data first",
        "Prioritise the information that supports important decisions, carries material risk or is reused across teams. A narrow, useful starting point is more likely to stick than a huge register no one maintains.",
      ],
      [
        "Give terms an owner",
        "A definition is only useful if someone can resolve questions and approve changes. Record business meaning, calculation, source and accountable owner for the most important terms.",
      ],
      [
        "Build checks into the work",
        "Where possible, automate validation in the data pipeline or reporting process. Make failures visible and assign a route to resolve them.",
      ],
      [
        "Match access to purpose",
        "Use only the fields needed for the agreed purpose and make access reflect job responsibilities. Sensitive data deserves deliberate handling, not casual duplication into new files.",
      ],
      [
        "Review what is working",
        "Track recurring quality issues, time to resolve them and feedback from users. Use that evidence to simplify controls and focus effort where it reduces real risk.",
      ],
    ],
    takeaway:
      "Choose a critical dataset and document its owner, purpose, key definitions, access expectations and three quality checks. That creates a practical foundation for broader governance.",
  },
  {
    slug: "choosing-metrics-that-lead-to-better-questions",
    cat: "Analytics",
    time: "5 min read",
    title: "Choosing metrics that lead to better questions",
    image: "art-metrics",
    intro:
      "A long list of metrics can look comprehensive while leaving people unsure what to do. Strong measurement starts with a decision and uses a small set of clearly defined indicators to reveal progress, risk and opportunities to investigate.",
    sections: [
      [
        "Start from a decision",
        "Ask what the audience needs to decide and what evidence would change that decision. This helps avoid collecting metrics simply because they are easy to count.",
      ],
      [
        "Balance outcomes and drivers",
        "Pair outcome measures with indicators that may explain them. For example, service performance may need both delivery outcomes and information about delays, capacity or process exceptions.",
      ],
      [
        "Define the denominator and time window",
        "Rates and comparisons are particularly easy to misread when populations, date ranges or exclusions differ. Make those choices explicit and consistent.",
      ],
      [
        "Show context, not just status",
        "A number is more useful with a target, trend, relevant comparison or explanation of uncertainty. Avoid implying that a single metric tells the whole story.",
      ],
      [
        "Retire metrics that no longer help",
        "Review whether people use each metric and whether it drives useful action. Remove or revise measures that create noise or reward the wrong behaviour.",
      ],
    ],
    takeaway:
      "For every proposed KPI, write one sentence explaining the decision it supports, how it is calculated and what action someone might take when it changes.",
  },
  {
    slug: "a-practical-first-step-toward-better-data-quality",
    cat: "Data foundations",
    time: "6 min read",
    title: "A practical first step toward better data quality",
    image: "art-first-step",
    intro:
      "Data quality can feel like a vast programme. A more effective beginning is to focus on one important dataset, identify the ways it fails users and introduce a small number of checks that can be acted on.",
    sections: [
      [
        "Ask where trust breaks down",
        "Speak to the people who use the data. Find the recurring missing fields, duplicate records, stale updates or unexpected values that create rework or poor decisions.",
      ],
      [
        "Prioritise by impact",
        "Not every defect deserves equal effort. Consider how often it occurs, which decisions it affects and whether a downstream control can limit the risk.",
      ],
      [
        "Turn expectations into rules",
        "Translate the most important expectations into explicit checks, such as required identifiers, valid status values, uniqueness or freshness thresholds.",
      ],
      [
        "Make failures actionable",
        "A check should identify what failed, where it happened and who can resolve it. A dashboard of red indicators without ownership rarely improves quality.",
      ],
      [
        "Measure improvement",
        "Track the number and severity of issues over time, plus the effort needed to resolve them. Use the results to adjust checks and address recurring source problems.",
      ],
    ],
    takeaway:
      "Pick one recurring defect, measure its current frequency, add a clear validation rule and agree an owner for the resulting exceptions.",
  },
];

function ArticleDetail({ slug }) {
  const article = fullArticles.find((a) => a.slug === slug);
  if (!article) return <NotFound />;
  return (
    <Layout>
      <PageHero
        eyebrow={`Ideas & perspectives · ${article.cat}`}
        title={article.title}
        emphasis=""
        body={article.intro}
        imageId={article.image}
      >
        <span className="article-read-time">
          <Clock3 size={15} />
          {article.time} · SkyStack perspective
        </span>
      </PageHero>
      <article className="section article-body-section">
        <div className="container article-layout">
          <aside className="article-aside">
            <span>IN THIS ARTICLE</span>
            {article.sections.map((s, i) => (
              <a href={`#article-section-${i}`} key={s[0]}>
                {s[0]}
              </a>
            ))}
            <div className="article-aside-note">
              <Database size={19} />
              <p>
                Practical data engineering, analytics and delivery perspectives
                from SkyStack.
              </p>
            </div>
          </aside>
          <div className="article-body">
            <p className="article-lead">{article.intro}</p>
            {article.sections.map((section, i) => (
              <section id={`article-section-${i}`} key={section[0]}>
                <h2>{section[0]}</h2>
                <p>{section[1]}</p>
              </section>
            ))}
            <div className="article-takeaway">
              <span>PUT IT INTO PRACTICE</span>
              <p>{article.takeaway}</p>
            </div>
            <div className="article-author">
              <div className="author-mark">S</div>
              <div>
                <strong>SkyStack Editorial</strong>
                <p>
                  Original practical perspective on data engineering, analytics
                  and business information. Examples are general guidance and
                  should be adapted to each organisation’s systems and
                  requirements.
                </p>
              </div>
            </div>
            <Link to="/contact" className="button button-primary">
              Discuss this with SkyStack <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </article>
      <section className="section detail-muted">
        <div className="container">
          <SectionHeading
            eyebrow="Keep exploring"
            title="Related perspectives"
          />
          <div className="related-articles">
            {fullArticles
              .filter((a) => a.slug !== slug)
              .slice(0, 3)
              .map((a) => (
                <Link
                  to={`/insights/${a.slug}`}
                  key={a.slug}
                  className="related-article"
                >
                  <div
                    style={{ backgroundImage: `url(${image(a.image, 500)})` }}
                  />
                  <span>
                    {a.cat.toUpperCase()} · {a.time.toUpperCase()}
                  </span>
                  <h3>{a.title}</h3>
                  <span className="insight-read">
                    Read article <ArrowUpRight size={15} />
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

const productItems = [
  {
    n: "01",
    icon: BarChart3,
    title: "Insight & reporting",
    tag: "SEE WHAT MATTERS",
    desc: "Dashboards and reports that give teams a consistent view of performance, with metrics people understand and can act on.",
  },
  {
    n: "02",
    icon: Database,
    title: "Data preparation",
    tag: "GET THE FOUNDATIONS RIGHT",
    desc: "Repeatable processes to collect, clean, validate and structure information from the systems you already use.",
  },
  {
    n: "03",
    icon: Workflow,
    title: "Workflow automation",
    tag: "MAKE GOOD WORK REPEATABLE",
    desc: "Reduce manual handling and hand-offs with connected workflows, checks and practical automation.",
  },
  {
    n: "04",
    icon: Layers3,
    title: "Data architecture",
    tag: "BUILD FOR WHAT’S NEXT",
    desc: "Fit-for-purpose data models and integration patterns that are documented, maintainable and ready to evolve.",
  },
];
function Products() {
  return (
    <Layout>
      <PageHero
        eyebrow="Products & solutions"
        title="The right tools for"
        emphasis="work that matters."
        body="Practical data products designed around your questions, your existing systems and your team's day-to-day reality."
        imageId="page-products"
      >
        <Link to="/contact" className="button button-primary">
          Find your fit <ArrowRight size={17} />
        </Link>
      </PageHero>
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Our solution toolkit"
            title="Purpose-built, not one-size-fits-all."
            body="Start with a specific business need. We’ll help you select and shape the right solution — without adding complexity for its own sake."
          />
          <div className="product-list">
            {productItems.map((p) => (
              <article className="product-row" key={p.n}>
                <div className="product-row-left">
                  <span className="product-icon">
                    <p.icon size={22} />
                  </span>
                  <span>{p.n}</span>
                </div>
                <div className="product-row-main">
                  <span className="product-tag">{p.tag}</span>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                </div>
                <Link
                  to="/contact"
                  className="round-arrow"
                  aria-label={`Discuss ${p.title}`}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section product-dark">
        <div className="container product-dark-grid">
          <div>
            <Eyebrow light>Designed to fit</Eyebrow>
            <h2>
              Make your existing stack <em>work smarter.</em>
            </h2>
            <p>
              We focus on useful outcomes, not tool sprawl. Solutions are shaped
              around your current environment, team capability and long-term
              needs.
            </p>
            <Link to="/contact" className="button button-white">
              Talk through your needs <ArrowRight size={16} />
            </Link>
          </div>
          <div className="stack-diagram">
            <div className="stack-node">
              <Database size={20} />
              <span>Your data sources</span>
            </div>
            <div className="stack-connector">
              <i />
              <i />
              <i />
            </div>
            <div className="stack-node stack-node-main">
              <Network size={22} />
              <span>SkyStack data layer</span>
              <small>Connect · Validate · Structure</small>
            </div>
            <div className="stack-connector">
              <i />
              <i />
              <i />
            </div>
            <div className="stack-outcomes">
              <span>
                <BarChart3 /> Insights
              </span>
              <span>
                <Workflow /> Workflows
              </span>
              <span>
                <FileCheck2 /> Reporting
              </span>
            </div>
          </div>
        </div>
      </section>
      <CTA />
    </Layout>
  );
}

function Delivery() {
  const phases = [
    [
      "01",
      "Discover",
      "Understand the business context, users and decisions that need to improve.",
      "Clear scope, shared priorities and success measures.",
    ],
    [
      "02",
      "Design",
      "Map data sources, definitions, workflows and the simplest fit-for-purpose approach.",
      "A practical plan with clear ownership and trade-offs.",
    ],
    [
      "03",
      "Build & Validate",
      "Develop in manageable increments, test the outputs and bring stakeholders along.",
      "A working solution reviewed against real needs.",
    ],
    [
      "04",
      "Enable & Improve",
      "Document the solution, support adoption and identify the next useful improvement.",
      "A maintainable outcome and a path forward.",
    ],
  ];
  return (
    <Layout>
      <PageHero
        eyebrow="Delivery"
        title="A thoughtful process."
        emphasis="A useful outcome."
        body="We keep delivery collaborative, transparent and grounded in the problem you’re trying to solve — from first conversation to ongoing improvement."
        imageId="page-delivery"
      >
        <Link to="/contact" className="button button-primary">
          Start a conversation <ArrowRight size={17} />
        </Link>
      </PageHero>
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="How we work"
            title="A clear path from question to confidence."
            body="The work is shaped around your context, with clear checkpoints and collaboration at every stage."
          />
          <div className="delivery-timeline">
            {phases.map((p) => (
              <article className="timeline-item" key={p[0]}>
                <div className="timeline-marker">{p[0]}</div>
                <div className="timeline-main">
                  <h3>{p[1]}</h3>
                  <p>{p[2]}</p>
                </div>
                <div className="timeline-output">
                  <span>WHAT YOU GET</span>
                  <p>{p[3]}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section delivery-principles">
        <div className="container">
          <SectionHeading
            eyebrow="Our principles"
            title="Good work should feel clear."
          />
          <div className="principle-grid">
            <article>
              <Compass />
              <h3>Business first</h3>
              <p>
                Start with the decision or process that needs to improve, not a
                tool looking for a problem.
              </p>
            </article>
            <article>
              <ShieldCheck />
              <h3>Trust by design</h3>
              <p>
                Build in quality checks, documentation and appropriate controls
                from the beginning.
              </p>
            </article>
            <article>
              <Network />
              <h3>Work together</h3>
              <p>
                Involve the people who use the information so the solution fits
                real workflows.
              </p>
            </article>
            <article>
              <MoveUpRight />
              <h3>Improve over time</h3>
              <p>
                Deliver in useful steps and leave room for learning, feedback
                and change.
              </p>
            </article>
          </div>
        </div>
      </section>
      <CTA />
    </Layout>
  );
}

function Specialists() {
  return (
    <Layout>
      <PageHero
        eyebrow="Specialists"
        title="The right questions."
        emphasis="The right expertise."
        body="Data work sits at the intersection of business understanding, technical craft and careful delivery. We bring those perspectives together around your goals."
        imageId="page-specialists"
      >
        <Link to="/contact" className="button button-primary">
          Meet your project team <ArrowRight size={17} />
        </Link>
      </PageHero>
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="Meet the people behind SkyStack"
            title="A personal approach. Deep technical craft."
            body="A focused team combining dependable data engineering with clear, decision-ready business intelligence."
          />
          <div className="people-grid">
            <article className="person-card">
              <div className="person-header">
                <div className="person-avatar avatar-aathi">
                  <img src="/images/Aathiraj.jpg" alt="Aathi Raj Hariram" />
                </div>

                <div className="person-meta">
                  <h3>Aathi Raj Hariram</h3>
                  <span className="person-role">
                    Founder &amp; Lead Data Engineer
                  </span>
                  <span className="person-location">DE · Germany</span>
                </div>
              </div>

              <p>
                Building reliable data foundations, scalable pipelines, and
                intelligent data solutions. Passionate about transforming
                complex data into meaningful insights and helping businesses
                make smarter, data-driven decisions.
              </p>

              <div className="person-tags">
                <span>Data engineering</span>
                <span>Cloud &amp; pipelines</span>
                <span>Data strategy</span>
              </div>
            </article>

            <article className="person-card">
              <div className="person-header">
                <div className="person-avatar avatar-vishva">
                  <img src="/images/Vishva.jpeg" alt="Vishva" />
                </div>

                <div className="person-meta">
                  <h3>Vishva</h3>
                  <span className="person-role">BI Analyst & Data Specialist</span>
                  <span className="person-location">IN · India</span>
                </div>
              </div>

              <p>
                Creates insightful dashboards and visual reports to simplify
                complex data, track business performance, and deliver clear
                answers to client questions.
              </p>

              <div className="person-tags">
                <span>Power BI</span>
                <span>Visual analytics</span>
                <span>Reporting</span>
              </div>
            </article>
            <article className="person-card">
              <div className="person-header">
                <div className="person-avatar avatar-sharukhan">
                  <img src="/images/Sharukhan.jpg" alt="Sharukhan" />
                </div>

                <div className="person-meta">
                  <h3>Mohammad Sharukhan Sulbikkar</h3>
                  <span className="person-role">Marketing Manager</span>
                  <span className="person-location">SA · Saudi Arabia</span>
                </div>
              </div>

              <p>
                Develops and executes marketing strategies, manages campaigns,
                strengthens brand visibility, and analyzes market trends to drive
                customer engagement and business growth.
              </p>

              <div className="person-tags">
                <span>Marketing Strategy</span>
                <span>Brand Development</span>
                <span>Digital Marketing</span>
              </div>
            </article>
            <article className="person-card">
              <div className="person-header">
                <div className="person-avatar avatar-suheir">
                  <img src="/images/Suhier.jpg" alt="Suheir" />
                </div>

                <div className="person-meta">
                  <h3>Suheir</h3>
                  <span className="person-role">Field Manager</span>
                  <span className="person-location">IN · India</span>
                </div>
              </div>

              <p>
                Oversees field operations, coordinates on-site activities, manages
                field teams, and ensures smooth execution of daily operations while
                maintaining service quality and achieving business targets.
              </p>

              <div className="person-tags">
                <span>Field Operations</span>
                <span>Team Management</span>
                <span>Customer Service</span>
              </div>
            </article>
          </div>

          <div className="specialist-grid">
            {[
              {
                icon: Compass,
                title: "Business & Process Analysts",
                desc: "Translate operational challenges into clear requirements, definitions and measurable outcomes.",
              },
              {
                icon: Database,
                title: "Data Engineers",
                desc: "Connect sources, structure information and build reliable, maintainable data pipelines.",
              },
              {
                icon: BarChart3,
                title: "BI & Analytics Specialists",
                desc: "Create clear metrics, meaningful dashboards and reporting people can confidently use.",
              },
              {
                icon: ShieldCheck,
                title: "Governance & Quality Specialists",
                desc: "Make information more dependable through validation, ownership, documentation and controls.",
              },
            ].map((s) => (
              <article key={s.title} className="specialist-card">
                <span>
                  <s.icon size={22} />
                </span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </article>
            ))}
          </div>
          <div className="note-panel">
            <div className="note-icon">
              <CircleHelp size={22} />
            </div>
            <div>
              <h3>Not sure which expertise you need?</h3>
              <p>
                That’s a good place to start. Tell us what’s getting in the way
                and we’ll help you work out the next step.
              </p>
            </div>
            <Link to="/contact" className="text-link">
              Talk it through <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <CTA />
    </Layout>
  );
}

function Insights() {
  const [filter, setFilter] = useState("All");
  const articles = [
    {
      cat: "Data foundations",
      time: "6 min read",
      title: "Why trustworthy reporting starts long before the dashboard.",
      desc: "The quiet work of definitions, ownership and data quality is what makes a dashboard worth trusting.",
      img: "art-trustworthy",
    },
    {
      cat: "Analytics",
      time: "5 min read",
      title: "From spreadsheet sprawl to a shared view of performance.",
      desc: "A practical way to move from competing numbers to a common understanding of what is happening.",
      img: "art-sprawl",
    },
    {
      cat: "Delivery",
      time: "4 min read",
      title: "Making data improvement a team effort, not an IT project.",
      desc: "Why the best data solutions start with the people who use the information every day.",
      img: "art-team",
    },
    {
      cat: "Governance",
      time: "7 min read",
      title: "Data governance that helps work move forward.",
      desc: "Useful guardrails can support good decisions without turning every task into a process burden.",
      img: "art-flow",
    },
    {
      cat: "Analytics",
      time: "5 min read",
      title: "Choosing metrics that lead to better questions.",
      desc: "Build reporting around decisions and behaviours, not just the numbers that are easy to count.",
      img: "art-metrics",
    },
    {
      cat: "Data foundations",
      time: "6 min read",
      title: "A practical first step toward better data quality.",
      desc: "Start small, identify where trust breaks down and focus on improvements people will notice.",
      img: "art-first-step",
    },
  ];
  const cats = [
    "All",
    "Data foundations",
    "Analytics",
    "Delivery",
    "Governance",
  ];
  return (
    <Layout>
      <PageHero
        eyebrow="Insights"
        title="Ideas for making"
        emphasis="data more useful."
        body="Practical perspectives on data quality, reporting, automation and the people behind better decisions."
        imageId="page-insights"
      />
      <section className="section">
        <div className="container">
          <div className="insights-filter-head">
            <SectionHeading
              eyebrow="The latest thinking"
              title="Useful ideas. Straight answers."
              body="Explore practical thinking to help you make sense of data and move forward with confidence."
            />
          </div>
          <div className="filter-tabs">
            {cats.map((c) => (
              <button
                className={filter === c ? "filter-tab selected" : "filter-tab"}
                key={c}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="insight-grid insights-full">
            {articles
              .filter((a) => filter === "All" || a.cat === filter)
              .map((a) => (
                <article className="insight-card" key={a.title}>
                  <div
                    className="insight-photo"
                    style={{ backgroundImage: `url(${image(a.img, 700)})` }}
                  />
                  <div className="insight-meta">
                    <span>{a.cat.toUpperCase()}</span>
                    <span>{a.time.toUpperCase()}</span>
                  </div>
                  <h3>{a.title}</h3>
                  <p className="insight-description">{a.desc}</p>
                  <Link
                    className="insight-read"
                    to={`/insights/${slugify(a.title)}`}
                  >
                    Read article <ArrowUpRight size={16} />
                  </Link>
                </article>
              ))}
          </div>
          <p className="content-note">
            These practical perspectives are original SkyStack editorial
            content. Adapt the recommendations to your organisation’s systems,
            risk profile and requirements.
          </p>
        </div>
      </section>
      <CTA />
    </Layout>
  );
}

function Contact() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    industry: "",
    message: "",
  });
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    setSent(true);
  };
  return (
    <Layout>
      <PageHero
        eyebrow="Contact"
        title="Let’s make your data"
        emphasis="work harder."
        body="Tell us what you’re trying to improve. We’ll start with the business challenge, ask the right questions and explore a practical way forward."
        imageId="page-contact"
      />
      <section className="section contact-section">
        <div className="container contact-grid">
          <div className="contact-info">
            <Eyebrow>Start a conversation</Eyebrow>
            <h2>Good work begins with a good question.</h2>
            <p>
              You don’t need a complete brief or a technical specification. A
              few details about what’s difficult today is plenty to start.
            </p>
            <div className="contact-detail">
              <span>
                <Mail size={18} />
              </span>
              <div>
                <small>Email</small>
                <a href="mailto:aathiraj.hariram@skystack.global">
                  aathiraj.hariram@skystack.global
                </a>
              </div>
            </div>
            <div className="contact-detail">
              <span>
                <Clock3 size={18} />
              </span>
              <div>
                <small>First conversation</small>
                <strong>Focused on your goals</strong>
                <p>No jargon. No one-size-fits-all pitch.</p>
              </div>
            </div>
            <div className="contact-assurance">
              <ShieldCheck size={19} />
              <p>
                We’ll use the details you provide to respond to your enquiry.
                Add your final privacy notice and data handling policy before
                launch.
              </p>
            </div>
          </div>
          <div className="contact-form-card">
            {sent ? (
              <div className="form-success">
                <span>
                  <Check size={24} />
                </span>
                <h2>Thanks for reaching out.</h2>
                <p>
                  Your form has been completed in this demo. To receive
                  enquiries, connect this form to your backend or a form service
                  before launch.
                </p>
                <button
                  className="button button-outline"
                  onClick={() => {
                    setSent(false);
                    setForm({
                      name: "",
                      email: "",
                      company: "",
                      industry: "",
                      message: "",
                    });
                  }}
                >
                  Send another enquiry
                </button>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="form-head">
                  <h3>Tell us a little about your project</h3>
                  <p>Fields marked * are required.</p>
                </div>
                <div className="form-row">
                  <label>
                    Your name *
                    <input
                      name="name"
                      value={form.name}
                      onChange={update}
                      required
                      placeholder="Name"
                    />
                  </label>
                  <label>
                    Work email *
                    <input
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={update}
                      required
                      placeholder="you@company.com"
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Company
                    <input
                      name="company"
                      value={form.company}
                      onChange={update}
                      placeholder="Your organisation"
                    />
                  </label>
                  <label>
                    Industry
                    <select
                      name="industry"
                      value={form.industry}
                      onChange={update}
                    >
                      <option value="">Choose an industry</option>
                      {[
                        "Manufacturing",
                        "Logistics & supply chain",
                        "Construction",
                        "Real estate",
                        "Marketing",
                        "Legal services",
                        "Other",
                      ].map((i) => (
                        <option key={i}>{i}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  What would you like to improve? *
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={update}
                    required
                    rows="5"
                    placeholder="Tell us about the challenge, process or decision you have in mind..."
                  />
                </label>
                <button
                  className="button button-primary form-submit"
                  type="submit"
                >
                  Send enquiry <ArrowRight size={17} />
                </button>
                <p className="form-privacy">
                  Demo form only — submissions are not transmitted or stored.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
      <CTA
        title="Not sure where to start?"
        body="A short conversation can help turn a broad data challenge into a clear next step."
        button="Start a conversation"
      />
    </Layout>
  );
}

function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState(() =>
    new URLSearchParams(window.location.search).get("subscribed")
      ? "Payment received. Your one-time password is on its way to your email. Sign in with it below."
      : "",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const result = await signIn(email, password);
      navigate(result.redirect, { replace: true });
    } catch (err) {
      setNotice(err.message);
    } finally {
      setBusy(false);
    }
  };
  if (user) return <Navigate to={`/portal/${user.client_code}`} replace />;
  return (
    <Layout>
      <section className="login-page">
        <div
          className="login-image"
          style={{
            backgroundImage: `url(${image("login", 1200)})`,
          }}
        >
          <div className="login-image-overlay" />
          <div className="login-image-content">
            <Logo light />
            <div>
              <Eyebrow light>SkyStack client workspace</Eyebrow>
              <h1>
                Your data.
                <br />
                <em>Your workspace.</em>
              </h1>
              <p>
                A dedicated place for the information, reporting and resources
                your team relies on.
              </p>
              <div className="login-trust">
                <ShieldCheck size={18} />
                <span>Private client access, designed with care.</span>
              </div>
            </div>
            <span className="login-image-foot">
              A clearer view of your business starts here.
            </span>
          </div>
        </div>
        <div className="login-panel">
          <div className="login-panel-inner">
            <div className="login-mobile-brand">
              <Logo />
            </div>
            <span className="login-overline">CLIENT PORTAL</span>
            <h2>Welcome back.</h2>
            <p className="login-subtitle">
              Sign in to access your SkyStack workspace.
            </p>
            <form onSubmit={submit} className="login-form">
              <label>
                Work email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@company.com"
                  autoComplete="username"
                />
              </label>
              <label>
                Password
                <div className="password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </label>
              <div className="login-options">
                <label className="remember-option">
                  <input type="checkbox" /> <span>Remember this device</span>
                </label>
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() =>
                    setNotice(
                      "To reset your password, please contact your workspace administrator.",
                    )
                  }
                >
                  Forgot password?
                </button>
              </div>
              <button
                type="submit"
                className="button button-primary login-submit"
                disabled={busy}
              >
                {busy ? (
                  "Signing in…"
                ) : (
                  <>
                    Sign in securely <ArrowRight size={17} />
                  </>
                )}
              </button>
              {notice && (
                <div className="login-notice" role="status">
                  <CircleHelp size={18} />
                  <p>{notice}</p>
                </div>
              )}
            </form>
            <div className="login-help">
              <LockKeyhole size={16} />
              <span>
                Need access?{" "}
                <button
                  type="button"
                  className="forgot-link"
                  onClick={() => openSubscribe()}
                >
                  Subscribe to SkyStack
                </button>{" "}
                or{" "}
                <Link to="/contact">contact our team.</Link>
              </span>
            </div>
            <Link className="demo-portal-link" to="/portal/demo">
              Explore the client portal demo <ArrowUpRight size={15} />
            </Link>
            <div className="login-security">
              <ShieldCheck size={17} />
              <span>Never share your password with anyone.</span>
            </div>
            <p className="login-legal">
              By continuing, you agree to your organisation’s applicable access
              policies.
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}

const demoEmployees = [
  {
    id: 1,
    name: "Amelia Hart",
    role: "Operations Director",
    department: "Operations",
    email: "amelia@northstar.example",
    status: "Active",
  },
  {
    id: 2,
    name: "Noah Fischer",
    role: "Data Coordinator",
    department: "Data & Analytics",
    email: "noah@northstar.example",
    status: "Active",
  },
  {
    id: 3,
    name: "Mia Schneider",
    role: "Finance Manager",
    department: "Finance",
    email: "mia@northstar.example",
    status: "Invited",
  },
];
const industryFields = {
  Manufacturing: [
    "Production sites",
    "Units produced this month",
    "Quality incidents",
    "Inventory systems",
  ],
  "Logistics & supply chain": [
    "Active vehicles",
    "Monthly shipments",
    "On-time delivery",
    "Warehouse systems",
  ],
  Construction: [
    "Active projects",
    "Sites in operation",
    "Budget tracked",
    "Project management system",
  ],
  "Real estate": [
    "Properties managed",
    "Occupied units",
    "Portfolio value",
    "Property management system",
  ],
  Marketing: [
    "Active campaigns",
    "Monthly ad spend",
    "Conversion rate",
    "Marketing platforms",
  ],
  "Legal services": [
    "Active matters",
    "Practice areas",
    "Document repositories",
    "Matter management system",
  ],
};
function PortalDemo() {
  const [tab, setTab] = useState("Overview");
  const [employees, setEmployees] = useState(demoEmployees);
  const [files, setFiles] = useState([]);
  const [showEmployee, setShowEmployee] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [showColumn, setShowColumn] = useState(false);
  const [extraColumns, setExtraColumns] = useState(["Location"]);
  const [newColumn, setNewColumn] = useState("");
  const [newEmployee, setNewEmployee] = useState({
    name: "",
    role: "",
    department: "",
    email: "",
    status: "Active",
  });
  const [profile, setProfile] = useState({
    company: "Northstar Operations Group",
    industry: "Manufacturing",
    overview:
      "A multi-site manufacturer focused on operational consistency, quality and reliable reporting.",
    website: "www.northstar.example",
    employees: "248",
    revenue: "€18.6m",
  });
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      from: "bot",
      text: "Hi Jordan — I’m the SkyStack support assistant. I can help with uploads, analytics, employee records, account access, or getting in touch with your specialist.",
    },
  ]);
  const nav = [
    "Overview",
    "Employees",
    "Data uploads",
    "Company profile",
    "Industry workspace",
    "Analytics dashboard",
    "Security & access",
  ];
  const uploadFiles = (e) => {
    const picked = Array.from(e.target.files || []).map((f) => ({
      name: f.name,
      size: f.size,
      type: f.type || "File",
      date: new Date().toLocaleDateString(),
    }));
    setFiles((prev) => [...prev, ...picked]);
    setNotice(
      picked.length ? `${picked.length} file(s) added to this local demo.` : "",
    );
    e.target.value = "";
  };
  const addEmployee = (e) => {
    e.preventDefault();
    setEmployees((prev) => [...prev, { ...newEmployee, id: Date.now() }]);
    setNewEmployee({
      name: "",
      role: "",
      department: "",
      email: "",
      status: "Active",
    });
    setShowEmployee(false);
    setNotice("Employee added to this demo workspace.");
  };
  const saveProfile = (e) => {
    e.preventDefault();
    setSaved(true);
    setNotice("Company profile saved in this demo session.");
  };
  const addColumn = (e) => {
    e.preventDefault();
    const v = newColumn.trim();
    if (v && !extraColumns.includes(v)) setExtraColumns([...extraColumns, v]);
    setNewColumn("");
    setShowColumn(false);
  };
  const activeFields =
    industryFields[profile.industry] || industryFields.Manufacturing;
  const answerSupport = (raw) => {
    const q = raw.toLowerCase();
    if (/upload|file|csv|excel|source data/.test(q))
      return "To add source files, open Data uploads in the workspace menu and choose the upload action. In this demo, file names are only recorded in your current browser session; files are not sent to SkyStack or stored securely yet. For production, we will connect secure storage and access controls.";
    if (
      /power bi|powerbi|fabric|dashboard|revenue|analytics|metric|report/.test(
        q,
      )
    )
      return "Open Analytics dashboard to explore the sample revenue, margin, delivery and data-quality metrics. These figures are illustrative and are not connected to Power BI, Microsoft Fabric, or a live business system yet. A live connection requires your report/workspace details and secure sign-in setup.";
    if (/employee|team member|custom column|directory/.test(q))
      return "Choose Employees from the workspace menu. You can add a team member and create a custom column for fields that matter to your organisation. Changes currently live only in this demo session and are not saved to a shared database.";
    if (/password|login|sign in|access|security|mfa/.test(q))
      return "The portal is currently a prototype, so secure sign-in, password reset, multi-factor authentication and organisation-level access rules are not active yet. Please do not enter real confidential data. I can help you contact the SkyStack team to discuss access.";
    if (/company|profile|industry/.test(q))
      return "Open Company profile to update your organisation name, industry, website, headcount, revenue range and overview. The demo keeps edits in the current session only.";
    if (/contact|specialist|human|support|talk|help me/.test(q))
      return "You can reach the SkyStack team using Get in touch in the workspace, or open the contact page. Include the page you were using and what you expected to happen; please do not send passwords or confidential source data.";
    return "I can help with source-data uploads, analytics and Power BI/Fabric, employee records, company profile, and account security. Try one of the quick questions below, or choose “Contact a specialist” if you need a person. I’m a demo assistant and can’t access your live systems.";
  };
  const sendChat = (text = chatInput) => {
    const clean = text.trim();
    if (!clean) return;
    setChatMessages((prev) => [
      ...prev,
      { from: "user", text: clean },
      { from: "bot", text: answerSupport(clean) },
    ]);
    setChatInput("");
  };
  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-brand">
          <Logo />
          <span className="portal-demo-pill">DEMO</span>
        </div>
        <div className="portal-org">
          <div className="org-avatar">N</div>
          <div>
            <strong>{profile.company}</strong>
            <small>Client workspace</small>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="portal-nav-label">WORKSPACE</div>
        <nav className="portal-side-nav">
          {nav.map((n, i) => (
            <button
              key={n}
              className={
                tab === n ? "portal-nav-item selected" : "portal-nav-item"
              }
              onClick={() => {
                setTab(n);
                setNotice("");
              }}
            >
              {[
                PanelTop,
                UsersIcon,
                CloudUploadIcon,
                Building2,
                Layers3,
                BarChart3,
                ShieldCheck,
              ][i] &&
                React.createElement(
                  [
                    PanelTop,
                    UsersIcon,
                    CloudUploadIcon,
                    Building2,
                    Layers3,
                    BarChart3,
                    ShieldCheck,
                  ][i],
                  { size: 17 },
                )}
              <span>{n}</span>
              {n === "Data uploads" && files.length > 0 && (
                <i>{files.length}</i>
              )}
            </button>
          ))}
        </nav>
        <div className="portal-sidebar-bottom">
          <div className="portal-help">
            <CircleHelp size={18} />
            <div>
              <strong>Need a hand?</strong>
              <small>Talk to your SkyStack team.</small>
              <button onClick={() => setShowSubscribe(true)}>
                Get in touch <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
          <button
            className="portal-user"
            onClick={() => setShowProfile(!showProfile)}
          >
            <span className="user-avatar">JD</span>
            <span>
              <strong>Jordan Davis</strong>
              <small>Workspace administrator</small>
            </span>
            <ChevronDown size={15} />
          </button>
          {showProfile && (
            <div className="profile-popover">
              <button
                onClick={() => {
                  setTab("Security & access");
                  setShowProfile(false);
                }}
              >
                Account settings
              </button>
              <Link to="/login">Exit demo portal</Link>
            </div>
          )}
        </div>
      </aside>
      <main className="portal-main">
        <header className="portal-topbar">
          <div className="portal-breadcrumb">
            <span>Client workspace</span>
            <span>/</span>
            <strong>{tab}</strong>
          </div>
          <div className="portal-top-actions">
            <span className="secure-indicator">
              <ShieldCheck size={15} /> Demo environment
            </span>
            <button
              className="portal-icon-btn"
              onClick={() => setShowSubscribe(true)}
              aria-label="Contact specialist"
            >
              <CircleHelp size={18} />
            </button>
            <span className="user-avatar">JD</span>
          </div>
        </header>
        <div className="portal-content">
          <div className="portal-welcome">
            <div>
              <div className="portal-overline">
                TUESDAY, 21 OCTOBER 2026 · CLIENT WORKSPACE
              </div>
              <h1>{tab === "Overview" ? "Good morning, Jordan." : tab}</h1>
              <p>
                {tab === "Overview"
                  ? "Here’s a clear view of your organisation, your data and the work in progress."
                  : tab === "Employees"
                    ? "Manage the people who have a role in your organisation’s data workspace."
                    : tab === "Data uploads"
                      ? "Securely prepare source files and give your SkyStack team context for processing."
                      : tab === "Company profile"
                        ? "Keep your organisation details and business context up to date."
                        : tab === "Industry workspace"
                          ? "Track the operational information most relevant to your industry."
                          : tab === "Analytics dashboard"
                            ? "Explore the business performance view with illustrative metrics and reporting visuals."
                            : "Manage workspace access and account security preferences."}
              </p>
            </div>
            <button
              className="button button-primary"
              onClick={() => setShowSubscribe(true)}
            >
              {" "}
              <Mail size={16} /> Get in touch <ArrowRight size={16} />
            </button>
          </div>
          {notice && (
            <div className="portal-notice" role="status">
              <Check size={16} />
              {notice}
              <button onClick={() => setNotice("")} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          )}
          {tab === "Overview" && (
            <>
              <div className="portal-stat-grid">
                <article className="portal-stat-card">
                  <div>
                    <span>Employees</span>
                    <UsersIcon size={18} />
                  </div>
                  <strong>{profile.employees || employees.length}</strong>
                  <small>
                    <i className="stat-dot blue" /> Organisation headcount
                  </small>
                </article>
                <article className="portal-stat-card">
                  <div>
                    <span>Annual revenue</span>
                    <BarChart3 size={18} />
                  </div>
                  <strong>{profile.revenue || "—"}</strong>
                  <small>Client-provided overview</small>
                </article>
                <article className="portal-stat-card">
                  <div>
                    <span>Data files uploaded</span>
                    <CloudUploadIcon size={18} />
                  </div>
                  <strong>{files.length}</strong>
                  <small>
                    {files.length
                      ? "Added in this demo session"
                      : "Ready for your first upload"}
                  </small>
                </article>
                <article className="portal-stat-card">
                  <div>
                    <span>Workspace status</span>
                    <ShieldCheck size={18} />
                  </div>
                  <strong className="status-word">In setup</strong>
                  <small>
                    <i className="stat-dot amber" /> Awaiting service kickoff
                  </small>
                </article>
              </div>
              <section className="portal-analytics-preview">
                <div className="analytics-preview-head">
                  <div>
                    <span className="portal-panel-kicker">
                      BUSINESS INTELLIGENCE
                    </span>
                    <h2>Performance at a glance</h2>
                    <p>
                      A sample dashboard showing how SkyStack can bring revenue,
                      operating performance and data quality into one view.
                    </p>
                  </div>
                  <button
                    className="subtle-action"
                    onClick={() => setTab("Analytics dashboard")}
                  >
                    Open analytics dashboard <ArrowRight size={14} />
                  </button>
                </div>
                <div className="analytics-kpis">
                  <div>
                    <span>Revenue this quarter</span>
                    <strong>€4.92m</strong>
                    <small className="positive-trend">
                      ↗ 8.4% vs previous quarter
                    </small>
                  </div>
                  <div>
                    <span>Gross margin</span>
                    <strong>32.8%</strong>
                    <small className="positive-trend">
                      ↗ 1.6 percentage points
                    </small>
                  </div>
                  <div>
                    <span>On-time delivery</span>
                    <strong>96.2%</strong>
                    <small>Target: 95%</small>
                  </div>
                  <div>
                    <span>Data quality score</span>
                    <strong>98.1%</strong>
                    <small>Across monitored datasets</small>
                  </div>
                </div>
                <div className="analytics-preview-charts">
                  <div className="analytics-chart-card">
                    <div className="chart-card-title">
                      <div>
                        <strong>Revenue trend</strong>
                        <small>Illustrative monthly revenue · €m</small>
                      </div>
                      <span>Last 6 months</span>
                    </div>
                    <div className="revenue-chart">
                      <div className="chart-y-labels">
                        <span>1.0</span>
                        <span>0.75</span>
                        <span>0.5</span>
                        <span>0.25</span>
                        <span>0</span>
                      </div>
                      <div className="chart-bars">
                        {[
                          ["May", 48],
                          ["Jun", 57],
                          ["Jul", 52],
                          ["Aug", 69],
                          ["Sep", 76],
                          ["Oct", 88],
                        ].map(([m, h]) => (
                          <div className="chart-bar-group" key={m}>
                            <div
                              className="chart-bar"
                              style={{ height: `${h}%` }}
                              title={`${m} revenue`}
                            >
                              <span />
                            </div>
                            <small>{m}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="analytics-chart-card">
                    <div className="chart-card-title">
                      <div>
                        <strong>Operational health</strong>
                        <small>Current reporting indicators</small>
                      </div>
                      <span>October</span>
                    </div>
                    <div className="health-list">
                      {[
                        ["Production plan attainment", 92, "#397da4"],
                        ["On-time delivery", 96, "#4b9a80"],
                        ["Inventory accuracy", 88, "#6c8db4"],
                        ["Data quality checks", 98, "#397da4"],
                      ].map(([name, val, color]) => (
                        <div className="health-row" key={name}>
                          <div>
                            <span>{name}</span>
                            <strong>{val}%</strong>
                          </div>
                          <div className="health-track">
                            <span
                              style={{ width: `${val}%`, background: color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="analytics-demo-disclaimer">
                  <ShieldCheck size={14} /> Demo preview · These figures are
                  illustrative sample data, not connected to a live company
                  system, Power BI or Microsoft Fabric.
                </p>
              </section>
              <div className="portal-overview-grid">
                <section className="portal-panel">
                  <div className="portal-panel-head">
                    <div>
                      <span className="portal-panel-kicker">ORGANISATION</span>
                      <h2>Company overview</h2>
                    </div>
                    <button
                      className="subtle-action"
                      onClick={() => setTab("Company profile")}
                    >
                      Edit profile <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <div className="company-overview">
                    <div className="company-logo-placeholder">N</div>
                    <div>
                      <h3>{profile.company}</h3>
                      <p>{profile.overview}</p>
                      <div className="company-tags">
                        <span>{profile.industry}</span>
                        <span>Client since 2026</span>
                      </div>
                    </div>
                  </div>
                  <div className="portal-detail-grid">
                    <div>
                      <small>Website</small>
                      <strong>{profile.website || "Not provided"}</strong>
                    </div>
                    <div>
                      <small>Team members</small>
                      <strong>{employees.length} listed in workspace</strong>
                    </div>
                    <div>
                      <small>Industry</small>
                      <strong>{profile.industry}</strong>
                    </div>
                    <div>
                      <small>Data programme</small>
                      <strong>Discovery & onboarding</strong>
                    </div>
                  </div>
                </section>
                <section className="portal-panel">
                  <div className="portal-panel-head">
                    <div>
                      <span className="portal-panel-kicker">
                        YOUR NEXT STEPS
                      </span>
                      <h2>Workspace checklist</h2>
                    </div>
                    <span className="checklist-count">2 of 4</span>
                  </div>
                  <div className="portal-checklist">
                    {[
                      [
                        "Company profile",
                        "Add the context our specialists need.",
                        true,
                      ],
                      ["Team details", "Keep key contacts up to date.", true],
                      [
                        "Source data",
                        "Upload a sample or source file.",
                        files.length > 0,
                      ],
                      [
                        "Kick-off conversation",
                        "Align on scope, priorities and outcomes.",
                        false,
                      ],
                    ].map(([t, d, done]) => (
                      <div className="portal-check-row" key={t}>
                        <span
                          className={
                            done ? "check-circle done" : "check-circle"
                          }
                        >
                          {done ? <Check size={13} /> : <span />}
                        </span>
                        <div>
                          <strong>{t}</strong>
                          <small>{d}</small>
                        </div>
                        {!done && (
                          <button
                            onClick={() =>
                              t === "Source data"
                                ? setTab("Data uploads")
                                : setShowSubscribe(true)
                            }
                          >
                            <ArrowRight size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <section className="portal-panel portal-recent">
                <div className="portal-panel-head">
                  <div>
                    <span className="portal-panel-kicker">TEAM</span>
                    <h2>People in your workspace</h2>
                  </div>
                  <button
                    className="subtle-action"
                    onClick={() => setTab("Employees")}
                  >
                    View employees <ArrowRight size={14} />
                  </button>
                </div>
                <EmployeeTable
                  employees={employees.slice(0, 3)}
                  extraColumns={extraColumns}
                />
              </section>
            </>
          )}
          {tab === "Analytics dashboard" && (
            <>
              <section className="portal-dashboard-hero">
                <div>
                  <span className="portal-panel-kicker">
                    SKYSTACK BUSINESS INTELLIGENCE
                  </span>
                  <h2>One view of business performance.</h2>
                  <p>
                    Bring financial, operational and data-quality signals
                    together so your team can see what is changing and where to
                    act.
                  </p>
                  <div className="dashboard-period">
                    <span className="period-active">Quarter to date</span>
                    <span>Year to date</span>
                    <span>Last 12 months</span>
                  </div>
                </div>
                <div className="dashboard-hero-mark">
                  <BarChart3 size={42} />
                  <span>DEMO ANALYTICS</span>
                </div>
              </section>
              <div className="portal-stat-grid analytics-stat-grid">
                <article className="portal-stat-card">
                  <div>
                    <span>Total revenue</span>
                    <BarChart3 size={18} />
                  </div>
                  <strong>€18.6m</strong>
                  <small>
                    <i className="stat-dot green" /> Illustrative annual revenue
                  </small>
                </article>
                <article className="portal-stat-card">
                  <div>
                    <span>Quarterly revenue</span>
                    <ArrowUpRight size={18} />
                  </div>
                  <strong>€4.92m</strong>
                  <small className="positive-trend">
                    ↗ 8.4% from prior quarter
                  </small>
                </article>
                <article className="portal-stat-card">
                  <div>
                    <span>Gross margin</span>
                    <Network size={18} />
                  </div>
                  <strong>32.8%</strong>
                  <small className="positive-trend">
                    ↗ 1.6 percentage points
                  </small>
                </article>
                <article className="portal-stat-card">
                  <div>
                    <span>Data quality score</span>
                    <ShieldCheck size={18} />
                  </div>
                  <strong>98.1%</strong>
                  <small>
                    <i className="stat-dot green" /> 4 monitored datasets
                  </small>
                </article>
              </div>
              <div className="analytics-full-grid">
                <section className="analytics-chart-card analytics-large-chart">
                  <div className="chart-card-title">
                    <div>
                      <strong>Revenue performance</strong>
                      <small>
                        Monthly revenue compared with plan · illustrative €m
                      </small>
                    </div>
                    <span className="chart-legend">
                      <i /> Actual
                    </span>
                  </div>
                  <div className="revenue-chart revenue-chart-large">
                    <div className="chart-y-labels">
                      <span>1.2</span>
                      <span>0.9</span>
                      <span>0.6</span>
                      <span>0.3</span>
                      <span>0</span>
                    </div>
                    <div className="chart-bars">
                      {[
                        ["May", 48, 44],
                        ["Jun", 57, 52],
                        ["Jul", 52, 55],
                        ["Aug", 69, 63],
                        ["Sep", 76, 70],
                        ["Oct", 88, 78],
                      ].map(([m, h, plan]) => (
                        <div className="chart-bar-group" key={m}>
                          <div className="chart-bar-pair">
                            <div
                              className="chart-bar"
                              style={{ height: `${h}%` }}
                              title={`${m} actual`}
                            />
                            <div
                              className="chart-bar plan"
                              style={{ height: `${plan}%` }}
                              title={`${m} plan`}
                            />
                          </div>
                          <small>{m}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="chart-insight">
                    <Sparkles size={16} />
                    <span>
                      <strong>What this suggests</strong> Revenue is trending
                      upward in this sample, with October showing the strongest
                      month in the period.
                    </span>
                  </div>
                </section>
                <section className="analytics-chart-card">
                  <div className="chart-card-title">
                    <div>
                      <strong>Operational performance</strong>
                      <small>Selected business indicators</small>
                    </div>
                    <span>October</span>
                  </div>
                  <div className="health-list health-list-large">
                    {[
                      ["Production plan attainment", 92, "#397da4"],
                      ["On-time delivery", 96, "#4b9a80"],
                      ["Inventory accuracy", 88, "#6c8db4"],
                      ["Quality pass rate", 97, "#4b9a80"],
                      ["Data quality checks", 98, "#397da4"],
                    ].map(([name, val, color]) => (
                      <div className="health-row" key={name}>
                        <div>
                          <span>{name}</span>
                          <strong>{val}%</strong>
                        </div>
                        <div className="health-track">
                          <span
                            style={{ width: `${val}%`, background: color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="health-summary">
                    <ShieldCheck size={17} />
                    <span>
                      <strong>4 of 4 datasets reporting</strong>
                      <small>Sample freshness and validation status</small>
                    </span>
                  </div>
                </section>
              </div>
              <div className="analytics-full-grid">
                <section className="portal-panel">
                  <div className="portal-panel-head">
                    <div>
                      <span className="portal-panel-kicker">
                        FINANCIAL BREAKDOWN
                      </span>
                      <h2>Revenue by business line</h2>
                      <p>Illustrative contribution to the current quarter.</p>
                    </div>
                  </div>
                  <div className="business-line-list">
                    {[
                      ["Core manufacturing", 42, "€2.07m"],
                      ["Service & maintenance", 27, "€1.33m"],
                      ["Distribution", 19, "€0.93m"],
                      ["Other", 12, "€0.59m"],
                    ].map(([name, percent, value]) => (
                      <div className="business-line" key={name}>
                        <div>
                          <span>{name}</span>
                          <strong>{value}</strong>
                        </div>
                        <div className="health-track">
                          <span style={{ width: `${percent}%` }} />
                        </div>
                        <small>{percent}% of quarterly revenue</small>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="portal-panel">
                  <div className="portal-panel-head">
                    <div>
                      <span className="portal-panel-kicker">
                        INSIGHTS TO INVESTIGATE
                      </span>
                      <h2>Signals worth reviewing</h2>
                      <p>
                        Example insights a connected analytics solution could
                        surface.
                      </p>
                    </div>
                  </div>
                  <div className="insight-list">
                    <div>
                      <span className="insight-symbol insight-blue">
                        <ArrowUpRight size={17} />
                      </span>
                      <span>
                        <strong>Revenue momentum</strong>
                        <small>
                          Quarterly revenue is 8.4% above the previous quarter
                          in this sample.
                        </small>
                      </span>
                    </div>
                    <div>
                      <span className="insight-symbol insight-green">
                        <Check size={17} />
                      </span>
                      <span>
                        <strong>Delivery above target</strong>
                        <small>
                          On-time delivery is 1.2 percentage points above the
                          95% target.
                        </small>
                      </span>
                    </div>
                    <div>
                      <span className="insight-symbol insight-amber">
                        <CircleHelp size={17} />
                      </span>
                      <span>
                        <strong>Inventory accuracy opportunity</strong>
                        <small>
                          Review the causes behind the 88% sample accuracy
                          indicator.
                        </small>
                      </span>
                    </div>
                  </div>
                </section>
              </div>
              <p className="analytics-demo-disclaimer">
                <ShieldCheck size={14} /> All values and insights on this page
                are fictional demo data. No live financial, ERP, Power BI or
                Microsoft Fabric connection is configured.
              </p>
              <section className="portal-panel powerbi-connect-panel">
                <div className="powerbi-connect-icon">
                  <BarChart3 size={23} />
                </div>
                <div>
                  <span className="portal-panel-kicker">
                    LIVE DATA, WHEN YOU'RE READY
                  </span>
                  <h2>Connect your Power BI or Fabric workspace</h2>
                  <p>
                    This layout is ready to be replaced with an authenticated
                    embedded Power BI report or a Microsoft Fabric-backed
                    analytics experience. A production connection needs a
                    report/workspace ID, Entra ID authentication,
                    server-generated embed tokens and client-specific
                    permissions.
                  </p>
                </div>
                <button
                  className="button button-outline"
                  onClick={() => setShowSubscribe(true)}
                >
                  Discuss an integration <ArrowRight size={15} />
                </button>
              </section>
            </>
          )}
          {tab === "Employees" && (
            <section className="portal-panel">
              <div className="portal-panel-head">
                <div>
                  <span className="portal-panel-kicker">
                    PEOPLE & PERMISSIONS
                  </span>
                  <h2>Employee directory</h2>
                  <p>
                    Maintain your organisation’s employee details and workspace
                    contacts.
                  </p>
                </div>
                <div className="portal-panel-actions">
                  <button
                    className="button button-outline"
                    onClick={() => setShowColumn(true)}
                  >
                    <Layers3 size={15} /> Add column
                  </button>
                  <button
                    className="button button-primary"
                    onClick={() => setShowEmployee(true)}
                  >
                    <span>+</span> Add employee
                  </button>
                </div>
              </div>
              <div className="employee-summary">
                <span>
                  <strong>{employees.length}</strong> employee records
                </span>
                <span>
                  <i className="stat-dot green" />{" "}
                  {employees.filter((e) => e.status === "Active").length} active
                </span>
                <span>Custom fields: {extraColumns.length}</span>
              </div>
              <EmployeeTable
                employees={employees}
                extraColumns={extraColumns}
                onRemove={(id) => {
                  setEmployees(employees.filter((e) => e.id !== id));
                  setNotice("Employee removed from this demo.");
                }}
              />
              <p className="portal-footnote">
                Demo data only. Azure Entra ID, role-based permissions and
                database persistence are not connected.
              </p>
            </section>
          )}
          {tab === "Data uploads" && (
            <>
              <section className="portal-panel upload-panel">
                <div className="portal-panel-head">
                  <div>
                    <span className="portal-panel-kicker">
                      SOURCE DATA INTAKE
                    </span>
                    <h2>Upload your source files</h2>
                    <p>
                      Share spreadsheets, exports and documents that help our
                      team understand your data landscape.
                    </p>
                  </div>
                  <span className="upload-shield">
                    <ShieldCheck size={20} />
                  </span>
                </div>
                <label className="upload-dropzone">
                  <input type="file" multiple onChange={uploadFiles} />
                  <span className="upload-cloud">
                    <CloudUploadIcon size={25} />
                  </span>
                  <strong>Choose files or drag them here</strong>
                  <small>
                    CSV, XLSX, XLS, PDF, JSON or ZIP · Demo accepts local file
                    selections only
                  </small>
                  <span className="button button-outline">Browse files</span>
                </label>
                <div className="upload-guidance">
                  <div>
                    <ShieldCheck size={17} />
                    <span>
                      <strong>Before uploading sensitive data</strong>
                      <small>
                        This prototype does not transmit files to SkyStack. Do
                        not use real confidential or personal data until secure
                        storage, access control and retention policies are
                        configured.
                      </small>
                    </span>
                  </div>
                  <div>
                    <FileCheck2 size={17} />
                    <span>
                      <strong>Helpful context</strong>
                      <small>
                        Include the source system, reporting period, data owner
                        and the question you want to answer.
                      </small>
                    </span>
                  </div>
                </div>
              </section>
              <section className="portal-panel">
                <div className="portal-panel-head">
                  <div>
                    <span className="portal-panel-kicker">FILE REGISTER</span>
                    <h2>
                      Uploaded files{" "}
                      <span className="inline-count">{files.length}</span>
                    </h2>
                  </div>
                  <button
                    className="subtle-action"
                    onClick={() =>
                      setNotice(
                        "In the production portal, uploads will be linked to a processing request and audit trail.",
                      )
                    }
                  >
                    How uploads work <CircleHelp size={14} />
                  </button>
                </div>
                {files.length === 0 ? (
                  <div className="empty-state">
                    <CloudUploadIcon size={25} />
                    <strong>No files added yet</strong>
                    <p>
                      Your selected files will appear here in this local
                      prototype.
                    </p>
                  </div>
                ) : (
                  <div className="file-list">
                    {files.map((f, i) => (
                      <div className="file-row" key={`${f.name}-${i}`}>
                        <span className="file-type-icon">
                          <FileCheck2 size={18} />
                        </span>
                        <div className="file-name">
                          <strong>{f.name}</strong>
                          <small>
                            {f.type || "File"} · {f.date}
                          </small>
                        </div>
                        <span className="file-size">
                          {(f.size / 1024).toFixed(1)} KB
                        </span>
                        <span className="file-status">Added locally</span>
                        <button
                          className="table-icon-button"
                          onClick={() =>
                            setFiles(files.filter((_, j) => j !== i))
                          }
                          aria-label={`Remove ${f.name}`}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
          {tab === "Company profile" && (
            <section className="portal-panel">
              <div className="portal-panel-head">
                <div>
                  <span className="portal-panel-kicker">
                    ORGANISATION DETAILS
                  </span>
                  <h2>Company profile</h2>
                  <p>
                    Tell us who you are and what your team needs from its data.
                  </p>
                </div>
              </div>
              <form className="portal-form" onSubmit={saveProfile}>
                <div className="logo-upload-row">
                  <div className="company-logo-placeholder large">
                    {profile.company?.[0] || "S"}
                  </div>
                  <div>
                    <strong>Company logo</strong>
                    <p>
                      Upload your organisation’s logo for your workspace
                      profile.
                    </p>
                    <label className="button button-outline logo-file-button">
                      Choose logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0])
                            setNotice(
                              `Logo selected: ${e.target.files[0].name}. Logo storage is not connected in this demo.`,
                            );
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="portal-form-grid">
                  <label>
                    Company name *
                    <input
                      required
                      value={profile.company}
                      onChange={(e) =>
                        setProfile({ ...profile, company: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Industry
                    <select
                      value={profile.industry}
                      onChange={(e) =>
                        setProfile({ ...profile, industry: e.target.value })
                      }
                    >
                      {Object.keys(industryFields).map((i) => (
                        <option key={i}>{i}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Company website
                    <input
                      value={profile.website}
                      onChange={(e) =>
                        setProfile({ ...profile, website: e.target.value })
                      }
                      placeholder="https://"
                    />
                  </label>
                  <label>
                    Employee count
                    <input
                      value={profile.employees}
                      onChange={(e) =>
                        setProfile({ ...profile, employees: e.target.value })
                      }
                      placeholder="e.g. 250"
                    />
                  </label>
                  <label>
                    Annual revenue / range
                    <input
                      value={profile.revenue}
                      onChange={(e) =>
                        setProfile({ ...profile, revenue: e.target.value })
                      }
                      placeholder="Optional"
                    />
                  </label>
                  <label>
                    Primary contact
                    <input defaultValue="Jordan Davis" />
                  </label>
                  <label className="form-span-two">
                    Company overview
                    <textarea
                      rows="4"
                      value={profile.overview}
                      onChange={(e) =>
                        setProfile({ ...profile, overview: e.target.value })
                      }
                      placeholder="What does your organisation do? What data challenges are you looking to solve?"
                    />
                  </label>
                </div>
                <div className="portal-form-footer">
                  <span>
                    {saved
                      ? "Changes saved in this demo session."
                      : "Fields marked * are required."}
                  </span>
                  <button className="button button-primary" type="submit">
                    Save profile <Check size={16} />
                  </button>
                </div>
              </form>
            </section>
          )}
          {tab === "Industry workspace" && (
            <>
              <section className="industry-workspace-banner">
                <div>
                  <span className="portal-panel-kicker">
                    TAILORED TO YOUR BUSINESS
                  </span>
                  <h2>{profile.industry} workspace</h2>
                  <p>
                    Industry-specific indicators are illustrative and can be
                    adapted to the metrics, systems and workflows that matter to
                    your organisation.
                  </p>
                </div>
                <div className="industry-workspace-icon">
                  {React.createElement(
                    {
                      Manufacturing: Factory,
                      "Logistics & supply chain": Truck,
                      Construction: Building2,
                      "Real estate": Building2,
                      Marketing: Megaphone,
                      "Legal services": Scale,
                    }[profile.industry] || Database,
                    { size: 30 },
                  )}
                </div>
              </section>
              <div className="industry-metric-grid">
                {activeFields.map((field, i) => (
                  <article className="industry-metric" key={field}>
                    <span>{field}</span>
                    <strong>
                      {
                        [
                          "—",
                          "To be configured",
                          "Not connected",
                          "Add details",
                        ][i]
                      }
                    </strong>
                    <small>Configure with your SkyStack specialist</small>
                  </article>
                ))}
              </div>
              <section className="portal-panel">
                <div className="portal-panel-head">
                  <div>
                    <span className="portal-panel-kicker">DATA SOURCES</span>
                    <h2>Systems & operational context</h2>
                    <p>
                      Record the systems that hold your source data so the
                      delivery team can plan the right connections.
                    </p>
                  </div>
                  <button
                    className="button button-outline"
                    onClick={() => setShowSubscribe(true)}
                  >
                    Discuss integrations <ArrowRight size={15} />
                  </button>
                </div>
                <div className="system-cards">
                  {[
                    "Core business system",
                    "Finance & reporting",
                    "Documents & collaboration",
                  ].map((n, i) => (
                    <div key={n}>
                      <span className="system-icon">
                        {[Database, BarChart3, FileCheck2].map(
                          (I, j) => i === j && <I key={n} size={18} />,
                        )}
                      </span>
                      <strong>{n}</strong>
                      <small>
                        {i === 0
                          ? "ERP / operational platform"
                          : i === 1
                            ? "Accounting / BI tools"
                            : "File stores / shared drives"}
                      </small>
                      <span className="system-unconfigured">Not connected</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {tab === "Security & access" && (
            <>
              <section className="portal-panel">
                <div className="portal-panel-head">
                  <div>
                    <span className="portal-panel-kicker">
                      ACCOUNT SECURITY
                    </span>
                    <h2>Password & security</h2>
                    <p>
                      Security controls shown here are design placeholders for
                      the future authenticated portal.
                    </p>
                  </div>
                  <span className="upload-shield">
                    <LockKeyhole size={20} />
                  </span>
                </div>
                <div className="security-setting">
                  <span className="security-setting-icon">
                    <LockKeyhole size={19} />
                  </span>
                  <div>
                    <strong>Password management</strong>
                    <small>
                      Password changes will be handled by the configured
                      identity provider.
                    </small>
                  </div>
                  <button
                    className="button button-outline"
                    onClick={() =>
                      setNotice(
                        "Password reset will be handled by Azure Entra ID or the selected identity provider.",
                      )
                    }
                  >
                    Change password
                  </button>
                </div>
                <div className="security-setting">
                  <span className="security-setting-icon">
                    <ShieldCheck size={19} />
                  </span>
                  <div>
                    <strong>Multi-factor authentication</strong>
                    <small>
                      Require an additional verification step for every client
                      account.
                    </small>
                  </div>
                  <span className="planned-pill">Planned</span>
                </div>
                <div className="security-setting">
                  <span className="security-setting-icon">
                    <UsersIcon size={19} />
                  </span>
                  <div>
                    <strong>Workspace roles</strong>
                    <small>
                      Separate administrators, contributors and read-only users.
                    </small>
                  </div>
                  <span className="planned-pill">Planned</span>
                </div>
                <div className="security-setting">
                  <span className="security-setting-icon">
                    <FileCheck2 size={19} />
                  </span>
                  <div>
                    <strong>Access and audit history</strong>
                    <small>
                      Record sign-ins, permission changes and file activity.
                    </small>
                  </div>
                  <span className="planned-pill">Planned</span>
                </div>
              </section>
              <section className="portal-panel">
                <div className="portal-panel-head">
                  <div>
                    <span className="portal-panel-kicker">
                      ACCESS MANAGEMENT
                    </span>
                    <h2>Workspace contacts</h2>
                  </div>
                  <button
                    className="button button-outline"
                    onClick={() => setTab("Employees")}
                  >
                    Manage employees <ArrowRight size={15} />
                  </button>
                </div>
                <p className="portal-muted">
                  Employee and access records are sample data only. Production
                  access must be enforced server-side, not by hiding interface
                  elements.
                </p>
              </section>
            </>
          )}
          <div className="portal-footer-note">
            <span>SkyStack client workspace · Prototype</span>
            <span>Sample information · Not connected to Azure</span>
          </div>
        </div>
      </main>
      <div className={`support-chat ${chatOpen ? "support-chat-open" : ""}`}>
        {chatOpen && (
          <section
            className="support-chat-panel"
            aria-label="SkyStack support assistant"
          >
            <header className="support-chat-header">
              <span className="support-bot-avatar">
                <Bot size={19} />
              </span>
              <div>
                <strong>SkyStack assistant</strong>
                <small>
                  <i /> Demo support · usually instant
                </small>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Close support chat"
              >
                <X size={18} />
              </button>
            </header>
            <div className="support-chat-intro">
              <strong>How can I help?</strong>
              <span>Ask a question about your workspace.</span>
            </div>
            <div className="support-chat-messages" aria-live="polite">
              {chatMessages.map((m, i) => (
                <div
                  key={i}
                  className={`support-chat-message ${m.from === "user" ? "from-user" : "from-bot"}`}
                >
                  {m.from === "bot" && (
                    <span className="chat-message-avatar">
                      <Bot size={13} />
                    </span>
                  )}
                  <p>{m.text}</p>
                </div>
              ))}
            </div>
            <div className="support-quick-questions">
              <button onClick={() => sendChat("How do I upload source data?")}>
                Upload data
              </button>
              <button
                onClick={() => sendChat("How do I view Power BI analytics?")}
              >
                Analytics help
              </button>
              <button
                onClick={() => sendChat("I need help with login and security")}
              >
                Login & security
              </button>
            </div>
            <form
              className="support-chat-compose"
              onSubmit={(e) => {
                e.preventDefault();
                sendChat();
              }}
            >
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your question…"
                aria-label="Type your support question"
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={!chatInput.trim()}
              >
                <Send size={16} />
              </button>
            </form>
            <Link
              to="/contact"
              className="support-chat-contact"
              onClick={() => setChatOpen(false)}
            >
              <LifeBuoy size={14} /> Contact a specialist{" "}
              <ArrowUpRight size={13} />
            </Link>
            <div className="support-chat-disclaimer">
              Demo assistant · No live systems or account records are accessed.
            </div>
          </section>
        )}
        <button
          className="support-chat-launcher"
          onClick={() => setChatOpen((v) => !v)}
          aria-label={
            chatOpen ? "Close support assistant" : "Open support assistant"
          }
        >
          {chatOpen ? (
            <X size={23} />
          ) : (
            <>
              <MessageCircle size={21} />
              <span>Need help?</span>
            </>
          )}
        </button>
      </div>
      {showEmployee && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setShowEmployee(false)
          }
        >
          <section className="portal-modal">
            <button
              className="modal-close"
              onClick={() => setShowEmployee(false)}
              aria-label="Close"
            >
              <X size={19} />
            </button>
            <span className="portal-panel-kicker">TEAM DIRECTORY</span>
            <h2>Add an employee</h2>
            <p>Add a contact to your organisation’s workspace directory.</p>
            <form className="portal-form" onSubmit={addEmployee}>
              <div className="portal-form-grid">
                <label>
                  Full name *
                  <input
                    required
                    value={newEmployee.name}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, name: e.target.value })
                    }
                    placeholder="Employee name"
                  />
                </label>
                <label>
                  Job title *
                  <input
                    required
                    value={newEmployee.role}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, role: e.target.value })
                    }
                    placeholder="Role or title"
                  />
                </label>
                <label>
                  Department
                  <input
                    value={newEmployee.department}
                    onChange={(e) =>
                      setNewEmployee({
                        ...newEmployee,
                        department: e.target.value,
                      })
                    }
                    placeholder="Department"
                  />
                </label>
                <label>
                  Work email *
                  <input
                    required
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, email: e.target.value })
                    }
                    placeholder="name@company.com"
                  />
                </label>
                <label>
                  Status
                  <select
                    value={newEmployee.status}
                    onChange={(e) =>
                      setNewEmployee({ ...newEmployee, status: e.target.value })
                    }
                  >
                    <option>Active</option>
                    <option>Invited</option>
                    <option>Inactive</option>
                  </select>
                </label>
                {extraColumns.map((c) => (
                  <label key={c}>
                    {c}
                    <input placeholder={`Enter ${c.toLowerCase()}`} />
                  </label>
                ))}
              </div>
              <div className="portal-form-footer">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setShowEmployee(false)}
                >
                  Cancel
                </button>
                <button className="button button-primary" type="submit">
                  Add employee <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {showColumn && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setShowColumn(false)
          }
        >
          <section className="portal-modal compact-modal">
            <button
              className="modal-close"
              onClick={() => setShowColumn(false)}
              aria-label="Close"
            >
              <X size={19} />
            </button>
            <span className="portal-panel-kicker">CUSTOMISE DIRECTORY</span>
            <h2>Add a column</h2>
            <p>Create a custom employee field for your organisation.</p>
            <form className="portal-form" onSubmit={addColumn}>
              <label>
                Column name
                <input
                  autoFocus
                  required
                  value={newColumn}
                  onChange={(e) => setNewColumn(e.target.value)}
                  placeholder="e.g. Site, Employee ID, Cost centre"
                />
              </label>
              <div className="portal-form-footer">
                <button
                  type="button"
                  className="button button-outline"
                  onClick={() => setShowColumn(false)}
                >
                  Cancel
                </button>
                <button className="button button-primary" type="submit">
                  Add column <ArrowRight size={15} />
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {showSubscribe && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setShowSubscribe(false)
          }
        >
          <section className="portal-modal subscribe-modal">
            <button
              className="modal-close"
              onClick={() => setShowSubscribe(false)}
              aria-label="Close"
            >
              <X size={19} />
            </button>
            <div className="subscribe-mark">
              <Sparkles size={22} />
            </div>
            <span className="portal-panel-kicker">SKYSTACK SERVICES</span>
            <h2>Let’s find the right fit.</h2>
            <p>
              Every organisation has different data needs. Talk to our
              specialists about a service plan, onboarding, or a tailored
              subscription.
            </p>
            <div className="subscribe-benefits">
              <span>
                <Check size={15} /> A plan shaped around your industry
              </span>
              <span>
                <Check size={15} /> Clear scope and delivery milestones
              </span>
              <span>
                <Check size={15} /> Guidance on secure data onboarding
              </span>
            </div>
            <Link
              to="/contact"
              className="button button-primary modal-cta"
              onClick={() => setShowSubscribe(false)}
            >
              Get in touch with our team <ArrowRight size={16} />
            </Link>
            <small className="modal-caption">
              No payment is taken in this prototype. Subscription and billing
              can be added later.
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
function UsersIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size || 18}
      height={props.size || 18}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function CloudUploadIcon(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={props.size || 18}
      height={props.size || 18}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 16l-4-4-4 4M12 12v9" />
      <path d="M20.4 16.5A5 5 0 0 0 19 6.7 7 7 0 0 0 5.1 9.1 4.5 4.5 0 0 0 5.5 18H8" />
    </svg>
  );
}
function EmployeeTable({ employees, extraColumns = [], onRemove }) {
  return (
    <div className="employee-table-wrap">
      <table className="employee-table">
        <thead>
          <tr>
            <th>EMPLOYEE</th>
            <th>DEPARTMENT</th>
            <th>WORK EMAIL</th>
            {extraColumns.map((c) => (
              <th key={c}>{c.toUpperCase()}</th>
            ))}
            <th>STATUS</th>
            {onRemove && <th />}
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id}>
              <td>
                <div className="employee-cell">
                  <span className="employee-avatar">
                    {e.name
                      .split(" ")
                      .map((x) => x[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <span>
                    <strong>{e.name}</strong>
                    <small>{e.role}</small>
                  </span>
                </div>
              </td>
              <td>{e.department || "—"}</td>
              <td>{e.email}</td>
              {extraColumns.map((c, i) => (
                <td key={c}>{e[c] || (i === 0 ? "—" : "—")}</td>
              ))}
              <td>
                <span
                  className={`employee-status ${e.status === "Active" ? "active" : e.status === "Invited" ? "invited" : "inactive"}`}
                >
                  <i />
                  {e.status}
                </span>
              </td>
              {onRemove && (
                <td>
                  <button
                    className="table-icon-button"
                    onClick={() => onRemove(e.id)}
                    aria-label={`Remove ${e.name}`}
                  >
                    <X size={15} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {employees.length === 0 && (
        <div className="empty-state">
          <UsersIcon size={24} />
          <strong>No employees yet</strong>
          <p>Add your first employee to start building the directory.</p>
        </div>
      )}
    </div>
  );
}
function CreateProfile() {
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [industry, setIndustry] = useState("Manufacturing");
  const [overview, setOverview] = useState("");
  const [logo, setLogo] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <Layout>
      <section className="signup-page">
        <div className="signup-intro">
          <Eyebrow>Client onboarding</Eyebrow>
          <h1>
            Your organisation.
            <br />
            <em>Your own workspace.</em>
          </h1>
          <p>
            Create a profile request so our team can understand your business,
            prepare your workspace and discuss the right service plan with you.
          </p>
          <div className="signup-steps">
            <span className={step === 1 ? "current" : ""}>
              01 <small>Company details</small>
            </span>
            <i />
            <span className={step === 2 ? "current" : ""}>
              02 <small>Business context</small>
            </span>
            <i />
            <span className={step === 3 ? "current" : ""}>
              03 <small>Review request</small>
            </span>
          </div>
        </div>
        <div className="signup-card">
          <div className="signup-card-top">
            <span>SKYSTACK CLIENT PROFILE</span>
            <span>STEP {step} OF 3</span>
          </div>
          {step === 1 ? (
            <>
              <h2>Let’s start with your company.</h2>
              <p>
                These details help us prepare the right onboarding conversation.
              </p>
              <form
                className="portal-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(2);
                }}
              >
                <label>
                  Company name *
                  <input
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your organisation"
                  />
                </label>
                <label>
                  Work email *
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                  />
                </label>
                <label>
                  Industry *
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  >
                    {Object.keys(industryFields).map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                  </select>
                </label>
                <button
                  className="button button-primary signup-next"
                  type="submit"
                >
                  Continue <ArrowRight size={16} />
                </button>
              </form>
            </>
          ) : step === 2 ? (
            <>
              <h2>Tell us about your business.</h2>
              <p>
                Share a little context and add your logo if you have one ready.
              </p>
              <form
                className="portal-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep(3);
                }}
              >
                <label>
                  Company overview *
                  <textarea
                    required
                    rows="5"
                    value={overview}
                    onChange={(e) => setOverview(e.target.value)}
                    placeholder="What does your company do, and what would you like to improve about your data?"
                  />
                </label>
                <label>
                  Company logo <span className="optional-label">OPTIONAL</span>
                  <input
                    className="native-file-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogo(e.target.files?.[0]?.name || "")}
                  />
                  {logo && (
                    <small className="selected-logo">
                      Selected: {logo} (not uploaded in this demo)
                    </small>
                  )}
                </label>
                <div className="signup-actions">
                  <button
                    className="button button-outline"
                    type="button"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </button>
                  <button className="button button-primary" type="submit">
                    Review profile <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h2>Review your profile request.</h2>
              <p>
                Here’s the information you’re preparing to share with SkyStack.
              </p>
              <div className="signup-review">
                <div>
                  <small>COMPANY</small>
                  <strong>{company}</strong>
                </div>
                <div>
                  <small>WORK EMAIL</small>
                  <strong>{email}</strong>
                </div>
                <div>
                  <small>INDUSTRY</small>
                  <strong>{industry}</strong>
                </div>
                <div>
                  <small>LOGO</small>
                  <strong>{logo || "Not provided"}</strong>
                </div>
                <div>
                  <small>OVERVIEW</small>
                  <p>{overview}</p>
                </div>
              </div>
              <div className="signup-actions">
                <button
                  className="button button-outline"
                  onClick={() => setStep(2)}
                >
                  Edit details
                </button>
                <button
                  className="button button-primary"
                  onClick={() =>
                    setNotice(
                      "Profile request prepared in demo mode. Connect a backend to submit onboarding requests and create a secure tenant workspace.",
                    )
                  }
                >
                  Request a workspace <ArrowRight size={16} />
                </button>
              </div>
              {notice && (
                <div className="portal-notice">
                  <Check size={16} />
                  {notice}
                </div>
              )}
            </>
          )}
          <div className="signup-privacy">
            <ShieldCheck size={16} />
            <span>
              Prototype only. Profile requests are not submitted or stored, and
              no account is created yet.
            </span>
          </div>
        </div>
        <div className="signup-return">
          <Link to="/login">
            <ArrowRight size={14} /> Already have an account? Sign in
          </Link>
        </div>
      </section>
    </Layout>
  );
}

function NotFound() {
  return (
    <Layout>
      <section className="not-found container">
        <Eyebrow>404 · Page not found</Eyebrow>
        <h1>
          This page seems to be <em>off the map.</em>
        </h1>
        <p>Let’s get you back to a clearer view.</p>
        <Link to="/" className="button button-primary">
          Back to homepage <ArrowRight size={17} />
        </Link>
      </section>
    </Layout>
  );
}

function ScrollToTop() {
  const location = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [location.pathname]);
  return null;
}

function IndustryDetailRoute() {
  const { slug } = useParams();
  return <IndustryDetail slug={slug} />;
}
function ExpertiseDetailRoute() {
  const { slug } = useParams();
  return <ExpertiseDetail slug={slug} />;
}
function ArticleDetailRoute() {
  const { slug } = useParams();
  return <ArticleDetail slug={slug} />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <SubscribeHost />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/expertise" element={<Expertise />} />
        <Route path="/expertise/:slug" element={<ExpertiseDetailRoute />} />
        <Route path="/industries/:slug" element={<IndustryDetailRoute />} />
        <Route path="/insights/:slug" element={<ArticleDetailRoute />} />
        <Route path="/products" element={<Products />} />
        <Route path="/delivery" element={<Delivery />} />
        <Route path="/specialists" element={<Specialists />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/portal/demo" element={<PortalDemo />} />
        <Route
          path="/portal/:clientCode"
          element={
            <RequireAuth>
              <LivePortal logo={<Logo />} />
            </RequireAuth>
          }
        />
        <Route
          path="/ops"
          element={
            <Suspense fallback={null}>
              <OpsConsole />
            </Suspense>
          }
        />
        <Route path="/create-profile" element={<CreateProfile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <CookieConsent />
    </>
  );
}

function CookieConsent() {
  const [choice, setChoice] = useState(null);
  const [ready, setReady] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("skystack-cookie-consent");
      if (saved) {
        const parsed = JSON.parse(saved);
        setChoice(parsed);
        setAnalytics(Boolean(parsed.analytics));
        setMarketing(Boolean(parsed.marketing));
      }
    } catch (_) {
      /* Consent UI remains usable if storage is unavailable. */
    }
    setReady(true);
  }, []);

  React.useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener("skystack:cookies", open);
    return () => window.removeEventListener("skystack:cookies", open);
  }, []);

  const save = (next) => {
    const value = {
      essential: true,
      analytics: Boolean(next.analytics),
      marketing: Boolean(next.marketing),
      savedAt: new Date().toISOString(),
    };
    setChoice(value);
    setAnalytics(value.analytics);
    setMarketing(value.marketing);
    setSettingsOpen(false);
    try {
      window.localStorage.setItem(
        "skystack-cookie-consent",
        JSON.stringify(value),
      );
    } catch (_) {
      /* Storage may be disabled. */
    }
  };

  if (!ready) return null;
  return (
    <>
      {!choice && (
        <div
          className="cookie-banner"
          role="dialog"
          aria-label="Cookie preferences"
          aria-modal="false"
        >
          <div className="cookie-banner-copy">
            <div className="cookie-title">
              <span className="cookie-icon">
                <ShieldCheck size={19} />
              </span>
              <h2>Your privacy matters</h2>
            </div>
            <p>
              SkyStack uses essential storage to make this website work. With
              your permission, optional analytics and marketing technologies can
              help us understand visits and improve our services.
            </p>
            <small>
              Essential storage is always active. Optional tracking is off
              unless you choose to enable it.
            </small>
          </div>
          <div className="cookie-actions">
            <button
              className="cookie-btn cookie-accept"
              onClick={() => save({ analytics: true, marketing: true })}
            >
              Accept all
            </button>
            <button
              className="cookie-btn cookie-reject"
              onClick={() => save({ analytics: false, marketing: false })}
            >
              Reject optional
            </button>
            <button
              className="cookie-customize"
              onClick={() => setSettingsOpen(true)}
            >
              Customize settings
            </button>
            <a href="/contact" className="cookie-privacy-link">
              Privacy questions?
            </a>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div
          className="cookie-settings-backdrop"
          onMouseDown={(e) =>
            e.target === e.currentTarget && setSettingsOpen(false)
          }
        >
          <section
            className="cookie-settings-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cookie-settings-title"
          >
            <button
              className="cookie-settings-close"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close cookie settings"
            >
              <X size={19} />
            </button>
            <span className="cookie-kicker">SKYSTACK · PRIVACY</span>
            <h2 id="cookie-settings-title">Cookie preferences</h2>
            <p className="cookie-settings-intro">
              Choose which optional technologies SkyStack may use. You can
              change these preferences at any time using Cookie settings.
            </p>
            <div className="cookie-category">
              <div>
                <strong>Essential storage</strong>
                <p>
                  Required for core website functions and remembering your
                  consent choice.
                </p>
              </div>
              <span className="cookie-always-on">Always on</span>
            </div>
            <label className="cookie-category cookie-toggle-row">
              <div>
                <strong>Analytics</strong>
                <p>Helps understand website usage and performance.</p>
              </div>
              <input
                type="checkbox"
                checked={analytics}
                onChange={(e) => setAnalytics(e.target.checked)}
              />
            </label>
            <label className="cookie-category cookie-toggle-row">
              <div>
                <strong>Marketing</strong>
                <p>
                  Allows marketing-related technologies, if added to the site.
                </p>
              </div>
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
              />
            </label>
            <div className="cookie-settings-actions">
              <button
                className="cookie-btn cookie-reject"
                onClick={() => save({ analytics: false, marketing: false })}
              >
                Reject optional
              </button>
              <button
                className="cookie-btn cookie-accept"
                onClick={() => save({ analytics, marketing })}
              >
                Save my choices
              </button>
            </div>
            <small className="cookie-disclaimer">
              This preference UI does not itself load analytics or marketing
              scripts. Connect and gate any future tracking tools before using
              them.
            </small>
          </section>
        </div>
      )}
    </>
  );
}
