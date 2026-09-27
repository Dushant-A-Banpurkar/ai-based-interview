import type { Metadata} from 'next';
import Providers from './providers';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata:Metadata={
  title:'AI Technical Interview Platform',
  description:'Real-time AI-powered technical interview evaluation',
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return(
    <html lang='en' className={cn("font-sans", geist.variable)}>
      <body className='bg-slate-950 text-slate-100 antialiased min-h-screen'>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}