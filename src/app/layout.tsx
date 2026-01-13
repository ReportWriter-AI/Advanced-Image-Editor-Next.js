import type { Metadata } from 'next'
import './globals.css'
import ClientLayout from '../components/ClientLayout'
import { Toaster } from '@/components/ui/sonner'
import Providers from './provider'

export const metadata: Metadata = {
  title: 'Report Writer AI',
  description: 'Report writing made easy',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
        <link rel="stylesheet" href="/shared-report-styles.css" />
      </head>
      <body>
        <Providers>
        <ClientLayout>
          {children}
        </ClientLayout>
        </Providers>
        <Toaster />
      </body>
    </html>
  )
}