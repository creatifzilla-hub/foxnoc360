import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { ThemeProvider } from "./components/ThemeProvider";
import { ToastProvider } from "./dashboard/components/Toast";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FoxNOC360 — ISP SLA Monitoring",
  description: "Multi-tenant ISP monitoring platform with real-time SLA tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/*
          Blocking theme script — runs BEFORE React hydration and BEFORE any
          CSS paint. Reads localStorage and applies html.dark immediately so
          the browser never renders in the wrong theme (eliminates flash).
          Default: "light" (no class needed since :root = light).
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var t = localStorage.getItem('theme');
    // If no preference stored OR preference is light, ensure no dark class
    if (t === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      // Remove legacy 'light' class from old theme system
      document.documentElement.classList.remove('light');
    }
  } catch(e) {}
})();
            `.trim(),
          }}
        />
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
      </head>
      <body className={`${poppins.variable} font-poppins antialiased`}>
        <ThemeProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
