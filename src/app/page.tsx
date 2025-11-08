import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted">
      <header className="border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="text-xl font-semibold tracking-tight">Advanced Image Editor</div>
          <Button asChild>
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col px-4 py-20">
        <section className="max-w-2xl space-y-6">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Next‑gen inspection workflows
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Elevate your inspection reports with powerful editing and automation tools.
          </h1>
          <p className="text-lg text-muted-foreground">
            Manage inspectors, streamline scheduling, and deliver pixel-perfect reports in minutes.
            Our AI-assisted editor and collaboration suite help teams stay efficient and impress clients.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/dashboard">Explore the Dashboard</Link>
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </div>
        </section>

        <section className="mt-16 grid gap-6 rounded-xl border bg-background/60 p-8 shadow-sm sm:grid-cols-3">
          {[
            {
              title: 'Smart Image Editing',
              description: 'Annotate, enhance, and deliver inspection visuals without leaving the browser.',
            },
            {
              title: 'Team Collaboration',
              description: 'Assign inspections, track progress, and keep your staff aligned in real time.',
            },
            {
              title: 'Automated Workflows',
              description: 'Generate professional reports and share them instantly with homeowners and partners.',
            },
          ].map((feature) => (
            <div key={feature.title} className="space-y-2">
              <h3 className="text-lg font-semibold text-foreground">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}