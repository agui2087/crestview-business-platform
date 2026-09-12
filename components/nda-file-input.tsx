"use client";

import {useId, useRef, useState} from "react";

export function NdaFileInput({locale,required=false}:{locale:string;required?:boolean}) {
  const es=locale==='es';
  const id=useId();
  const input=useRef<HTMLInputElement>(null);
  const [filename,setFilename]=useState('');
  return <div className="nda-file-picker">
    <label htmlFor={id}>{es?'NDA revisado':'Reviewed NDA'}</label>
    <button type="button" className="button button--primary" onClick={()=>input.current?.click()}>{es?'Subir NDA PDF':'Upload NDA PDF'}</button>
    <input ref={input} id={id} name="nda_file" type="file" accept="application/pdf,.pdf" required={required} aria-describedby={`${id}-help`} onChange={event=>setFilename(event.currentTarget.files?.[0]?.name??'')}/>
    <p role="status" className="nda-file-name">{filename?`${es?'Seleccionado':'Selected'}: ${filename}`:es?'Ningún archivo seleccionado.':'No file selected.'}</p>
    <small id={`${id}-help`}>{es?'Solo PDF, máximo 10 MB. Después de seleccionar el archivo, guarda el NDA.':'PDF only, maximum 10 MB. After selecting your file, save the NDA.'}</small>
  </div>;
}
