import { FeeIcon, SchoolIcon, SearchIcon, UsersIcon, GraduationCapIcon, FilterIcon, StarOutlineIcon, VideoIcon } from "../icons";

const centerIconTileStyle = { background: "var(--color-accent-200)", border: "none", color: "var(--color-accent-800)" };
const studentIconTileStyle = { background: "var(--color-accent-2-200)", border: "none", color: "var(--color-accent-2-800)" };

export function Hero() {
  return (
    <header id="hero" style={{ position: "relative", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: -160,
          top: -140,
          width: 340,
          height: 340,
          borderRadius: "50%",
          background: "var(--color-accent-100)",
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: -180,
          top: 80,
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: "var(--color-accent-2-100)",
          zIndex: 0,
        }}
      />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "96px 24px 88px", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 56px" }}>
          <span
            style={{
              display: "block",
              fontSize: 13,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--color-accent-700)",
              marginBottom: 16,
            }}
          >
            The coaching marketplace
          </span>
          <h1 style={{ fontSize: "clamp(34px,4.6vw,54px)", lineHeight: 1.1, margin: 0 }}>
            One platform, two sides of the classroom.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.6, margin: "20px 0 0", color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
            Clazzo connects coaching centers with the students looking for them — built for institutes to grow
            online, and for students to find the right fit fast.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
          <div style={{ background: "var(--color-accent-100)", borderRadius: 32, padding: 40, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", display: "grid", placeContent: "center", ...centerIconTileStyle }}>
              <SchoolIcon size={26} strokeWidth={2.75} />
            </div>
            <h2 style={{ fontSize: 27, margin: 0 }}>Grow your institute online.</h2>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
              List your courses and batches, manage students and fees, and get discovered by students searching for
              what you teach.
            </p>
            <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
                <UsersIcon size={17} color="var(--color-accent-700)" />
                Student &amp; batch management
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
                <FeeIcon size={17} color="var(--color-accent-700)" />
                Fee tracking built in
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
                <SearchIcon size={17} color="var(--color-accent-700)" />
                Get discovered by search
              </div>
            </div>
            <a href="#" className="btn btn-primary" style={{ marginTop: 8, fontSize: 15, padding: "13px 22px" }}>
              Register Your Coaching Center
            </a>
          </div>

          <div style={{ background: "var(--color-accent-2-100)", borderRadius: 32, padding: 40, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", display: "grid", placeContent: "center", ...studentIconTileStyle }}>
              <GraduationCapIcon size={26} strokeWidth={2.75} />
            </div>
            <h2 style={{ fontSize: 27, margin: 0 }}>Find and join the right coaching center.</h2>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "color-mix(in srgb, var(--color-text) 72%, transparent)" }}>
              Compare coaching centers by subject, location and price, read real reviews from other students, and
              enroll online.
            </p>
            <div style={{ display: "grid", gap: 12, marginTop: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
                <FilterIcon size={17} color="var(--color-accent-2-700)" />
                Filter by subject, location, price
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
                <StarOutlineIcon size={17} color="var(--color-accent-2-700)" strokeWidth={2.75} />
                Real reviews from students
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14.5 }}>
                <VideoIcon size={17} color="var(--color-accent-2-700)" />
                Book a demo before you enroll
              </div>
            </div>
            <a
              href="#"
              className="btn"
              style={{ marginTop: 8, fontSize: 15, padding: "13px 22px", background: "var(--color-accent-2)", color: "var(--color-bg)" }}
            >
              Find a Coaching Center
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
