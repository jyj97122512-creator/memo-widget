import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

export const metadata: Metadata = {
  title: "BUDDYMEMO 7.0",
  description: "노션 메모 위젯",
};

const dungGeunMo = localFont({
  src: "../public/fonts/DungGeunMo.ttf",
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={dungGeunMo.className}>
      <body>{children}</body>
    </html>
  );
}
