import mongoose,{Document, Model, Schema} from "mongoose";



export interface ICanditateReport extends Document{
    executiveSummary:string,
    overallScore:number,
    recommendation:"Strong Hire"|"Hire"|"Lean Reject"|"Reject",
    
    technicalEvaluation?:{
        score:number;
        problemSolvingScore:number;
        codeQualtiyScore:number;
        correctnessScore:number;
        codeAnalysis:string[];
        strengths:string[];
        improvements:string[];
    };
    communicationEvaluation?:{
        score:number;
        clarityAndStructure:string;
        deliveryAndConfidence:string;
        fillerWordsObserved:string[];
    };

    questionBreakdown:Array<{
        questionText:string;
        candidateResponseSummary:string;
        score:string;
        keyTakeaway:string
    }>;

    redFlags:string[];
    recommendedFollowUps:string[]
}
const CandiateReportSchema=new Schema({
    executiveSummary:{
        type:String,
        required:true,
        trim: true
    },
    overallScore:{
        type:Number,
        min:0,
        max:100,
        required:true,
    },
    recommendation:{
        type:String,
        enum:{
            values:["Strong Hire",
            "Hire",
            "Lean Hire",
            "Lean Reject",
            "Reject"],
            message:"{VALUE} is not a valid recommendation option"
        },
        required:true,
        trim: true
    },
    technicalEvaluation:{
        type:{
            score:{type:Number,min:1,max:100},
            problemSolvingScore:{type:Number,min:1,max:10},
            codeQualtiyScore:{type:Number,min:1,max:10},
            correctnessScore:{type:Number,min:1,max:10},

            codeAnalysis:{type:String,trim:true},
            strengths:[String],
            improvements:[String],
        },
        default:undefined,
        required:true
    },
    communicationEvaluation:{
        type:{
            score:{type:Number,min:1,max:10},
            clarityAndStructure:{type:String,trim:true},
            deliveryAndConfidence:{type:String,trim:true},
            fillerWordsObserved:[String]
        },
        default:undefined
    },

    questionBreakdown:[
        {
            questionText:{type:String,required:true},
            candidateResponseSummary:{type:String,requied:true},
            score:{type:Number,min:1,max:10,required:true},
            keyTakeaway:{type:String,required:true}
        }
    ],
    redFlags:{
        type:[String],
        default:undefined
    },
    recommendedFollowUps:{
        type:[String],
        default:undefined
    }
},{
    timestamps:true,
    versionKey:false
});

export const CandiateReportModel:Model<ICanditateReport>=mongoose.models.CandiateReport || mongoose.model<ICanditateReport>("CandiateReport",CandiateReportSchema);