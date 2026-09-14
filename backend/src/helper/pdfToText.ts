import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"

export async function extractTextFromArrayBuffer(arrayBuffer:ArrayBuffer|Uint8Array):Promise<string> {
    const loadingTask=pdfjsLib.getDocument({data:arrayBuffer});
    const doc=await loadingTask.promise;
    const maxPages=doc.numPages;
    let fullText="";

    for(let i=1;i<=maxPages;i++){
        const page=await doc.getPage(i);
        const textContent=await page.getTextContent();
        const pageText=textContent.items.map((item:any)=>item.str).join(" ");
        fullText +=`\n\n--- PAGE ${i} ---\n` + pageText;
    }
    return fullText;
}