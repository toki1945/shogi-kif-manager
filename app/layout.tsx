import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "棋譜帖 | 一局を、次の一手へ。",
  description: "将棋の棋譜を取り込み、並べ、振り返る。あなたの一局を育てる棋譜管理アプリ。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>{children}</body></html>;
}
