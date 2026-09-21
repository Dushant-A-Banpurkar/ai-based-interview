'use client';

import { selectLiveRms } from "@/src/store/selectors/interviewSelectors";
import { useSelector } from "react-redux";

export default function Audio() {
    const rawRms=useSelector(selectLiveRms);

    const volumePercentage=Math.min(Math.max(rawRms *150,5),100);

    return(
        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                <svg className={`h-5 w-5 transition-colors duration-200 ${volumePercentage>10 ? 'text-emerald-400' : 'text-slate-500'}`} fill="currentColor"
                    viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                    </svg>
            </div>
            <div className="flex h-8 flex-1 items-end gap-1 overflow-hidden">
                {[...Array(24)].map((_,i)=>{
                    const barHeight=i*2===0?volumePercentage:volumePercentage*0.7;

                    return(
                        <div key={i} className="w-full rounded-sm bg-emerald-500 transition-all duration-75" style={{height:`${barHeight}`,
                            opacity:volumePercentage>10?1:0.3
                        }}>

                        </div>
                    )
                })}
            </div>
        </div>
    )
}