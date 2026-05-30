import type { Metadata } from "next";
import { Nanum_Gothic_Coding } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "버디메모",
  description: "노션 메모 위젯",
};

const mono = Nanum_Gothic_Coding({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={mono.className}>
      <body>{children}</body>
    </html>
  );
}
