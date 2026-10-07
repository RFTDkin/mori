import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "M.O.R.I. - Tactical AI Command",
  description: "Cyberpunk AI Voice Assistant Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
      </body>
    </html>
  );
}
