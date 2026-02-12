import type { Metadata } from "next";
import { Inter, Noto_Sans_JP, Crimson_Pro } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const noto = Noto_Sans_JP({ subsets: ["latin"], variable: "--font-noto" });
const crimson = Crimson_Pro({ subsets: ["latin"], variable: "--font-crimson" });

export const metadata: Metadata = {
  title: "エージェントの成長記録",
  description: "ALFWorldのエピソードをストーリー形式で振り返る",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${inter.variable} ${noto.variable} ${crimson.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
