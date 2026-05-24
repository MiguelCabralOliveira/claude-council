import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Council",
  description: "A debate, not a chat. Bring your own skills.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
