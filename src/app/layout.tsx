import type { Metadata } from "next";
import "./globals.css";
import HeaderNav from "@/components/layout/HeaderNav";

export const metadata: Metadata = {
  title: "판매 대시보드 | 리커밋",
  description: "네이버 스마트스토어 & 쿠팡 월별 매출 분석 리포트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">
              리커밋 판매 대시보드
            </h1>
            <HeaderNav />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
