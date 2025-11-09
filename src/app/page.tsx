import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted">
      <header className="border-b bg-background/70 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-4 sm:flex-row sm:items-center">
          <div className="text-xl font-semibold tracking-tight sm:text-2xl">Advanced Image Editor</div>
          <div className="flex w-full gap-3 sm:w-auto">
            <Button asChild className="w-full sm:w-auto">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/sample-report">Make A Sample Report</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-16 sm:gap-20 sm:py-20">
        <section className="max-w-3xl space-y-6">
          <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            Next‑gen inspection workflows
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Elevate your inspection reports with powerful editing and automation tools.
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Manage inspectors, streamline scheduling, and deliver pixel-perfect reports in minutes.
            Our AI-assisted editor and collaboration suite help teams stay efficient and impress clients.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/dashboard">Explore the Dashboard</Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              Learn More
            </Button>
            <Button size="lg" variant="secondary" asChild className="w-full sm:w-auto">
              <Link href="/sample-report">Make A Sample Report</Link>
            </Button>
          </div>
        </section>

        <section className="grid gap-6 rounded-xl border bg-background/60 p-6 shadow-sm sm:grid-cols-3 sm:p-8">
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