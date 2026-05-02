const brand = process.env.NEXT_PUBLIC_BRAND_NAME ?? 'Forjio Brand';

export default function MarketingLandingPage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '64px 24px' }}>
      <header style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 48, fontWeight: 800, margin: 0 }}>{brand}</h1>
        <p style={{ fontSize: 18, color: 'var(--muted)', marginTop: 8 }}>
          Part of the Forjio commerce suite.
        </p>
        <div style={{ marginTop: 24 }}>
          <a
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              background: 'var(--primary)',
              color: 'var(--primary-fg)',
              borderRadius: 8,
              fontWeight: 600,
            }}
          >
            Sign in
          </a>
        </div>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {[1, 2, 3].map((i) => (
          <article
            key={i}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 24,
            }}
          >
            <h3 style={{ marginTop: 0 }}>Feature {i}</h3>
            <p style={{ color: 'var(--muted)', margin: 0 }}>
              Replace this placeholder with something actual users will read.
            </p>
          </article>
        ))}
      </section>

      <footer style={{ marginTop: 96, color: 'var(--muted)', fontSize: 14 }}>
        <p>
          Powered by{' '}
          <a href="https://forjio.com" style={{ fontWeight: 600 }}>
            Forjio
          </a>
          .
        </p>
      </footer>
    </main>
  );
}
