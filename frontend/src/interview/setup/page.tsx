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
      <form onSubmit={handleSubmit} className="space-y-6 bg-slate-900 p-6 rounded-xl border border-slate-800">
        <div>
          <label className="block text-sm font-medium mb-2">Candidate ID</label>
          <input
            type="text"
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            value={formData.candidateId}
            onChange={(e) => setFormData({ ...formData, candidateId: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Role Title</label>
          <input
            type="text"
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            value={formData.roleTitle}
            onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Target Skills (Comma Separated)</label>
          <input
            type="text"
            placeholder="React, Node.js, TypeScript"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            value={formData.targetSkills}
            onChange={(e) => setFormData({ ...formData, targetSkills: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Job Description</label>
          <textarea
            required
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            value={formData.jobDescription}
            onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Resume Text</label>
          <textarea
            rows={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            value={formData.resumeText}
            onChange={(e) => setFormData({ ...formData, resumeText: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Difficulty Mode</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white"
            value={formData.difficultyMode}
            onChange={(e) => setFormData({ ...formData, difficultyMode: e.target.value })}
          >
            <option value="beginner">Beginner</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
            <option value="extreme">Extreme</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 font-medium rounded-lg p-3 text-center text-white"
        >
          {loading ? 'Initializing Session...' : 'Start Interview Session'}
        </button>
      </form>
    </main>
    )
}