import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaRegister from "../components/PwaRegister";

export const metadata: Metadata = {
  title: "全球商情雷达 | AI Business Intelligence Radar",
  description: "Global multi-industry market intelligence dashboard",
  manifest: "/manifest.json",
  icons: {
    apple: "/icons/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#FBFBFA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning={true}>
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning={true}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
