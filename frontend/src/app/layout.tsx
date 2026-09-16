import type { Metadata} from 'next';
import Providers from './providers';
import './globals.css';


export const metadata:Metadata={
  title:'AI Technical Interview Platform',
  description:'Real-time AI-powered technical interview evaluation',
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return(
    <html lang='en'>
      <body className='bg-slate-950 text-slate-100 antialiased min-h-screen'>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}