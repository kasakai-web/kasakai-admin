import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kasakai.in"),
  title: {
    default: "Kasa Kai — Admin",
    template: "%s | Kasa Kai Admin",
  },
  description: "Kasa Kai admin control centre. Monitor events, manage approvals, track payouts, and oversee platform operations.",
  keywords: ["admin", "dashboard", "Kasa Kai", "platform"],
  openGraph: {
    siteName: "Kasa Kai",
    title: "Kasa Kai — Admin",
    description: "Platform admin control centre.",
    type: "website",
    images: [
      {
        url: "/kasa-kai-logo.svg",
        width: 128,
        height: 128,
        alt: "Kasa Kai",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
