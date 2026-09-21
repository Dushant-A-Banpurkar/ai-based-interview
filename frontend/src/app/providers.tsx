"use client";

import {Provider as ReduxProvider} from 'react-redux';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {useState} from 'react';
import { store } from '../store/store';



export default function Providers({children}:{children:React.ReactNode}){
    const [queryClient]=useState(()=>{
        return new QueryClient({
            defaultOptions:{
                queries:{
                    refetchOnWindowFocus:false,
                    retry:1
                }
            }
        })
    })
    return(
        <ReduxProvider store={store}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </ReduxProvider>
    )
};
