import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "★ メモリスト",
  description: "노션 메모 위젯",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
