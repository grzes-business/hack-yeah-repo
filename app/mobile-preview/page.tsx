import { notFound } from "next/navigation";
import { MobilePreview } from "../components/mobile-preview";
export default function Preview(){if(process.env.NODE_ENV==="production")notFound();return <MobilePreview/>;}
