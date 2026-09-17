'use client';

import React,{useState} from "react";
import {useRouter} from 'next/navigation';
import axios from "axios";


export default function SetupPage(){
    const router=useRouter();
    const [loading,setLoading]=useState(false);
    const [formData,setFormData]=useState({
        candidateId:'',
        roleTitle:'',
        targetSkills:'',
        jobDescription:'',
        resumeText:'',
        difficultyMode:'medium',
        enableSandbox:true
    });

    const handleSubmit=async (e:React.FormEvent)=>{
        e.preventDefault();
        setLoading(true);

        try{
            const payload={
                ...formData,
                targetSkills:formData.targetSkills.split(',').map((s)=>s.trim())
            };

            const response=await axios.post(`/api/interview`,payload);
            const {interviewId} =response.data;

            router.push(`interview/${interviewId}`);
        }
        catch(error){
            console.error('Failed to create session:',error);
            alert('Error creating intetview session')
        }finally{
            setLoading(false);
        }
    }
    return(
        <main className="max-w-3xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-6">Setup AI Technical Interview</h1>
            <form onSubmit={handleSubmit} className="space-y-6"></form>
        </main>
    )
}