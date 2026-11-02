const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const cr=(a,b)=>{const x=lum(a),y=lum(b);return ((Math.max(x,y)+.05)/(Math.min(x,y)+.05))};
module.exports={cr};
if(require.main===module){
const pairs=[
['white on primary','#FFFFFF','#DE3030','text 4.5'],
['white on primary-hover','#FFFFFF','#BF2626','text 4.5'],
['primary on white (large/UI)','#DE3030','#FFFFFF','ui 3'],
['primary-ink on white','#B52424','#FFFFFF','text 4.5'],
['primary-ink on primary-soft','#B52424','#FDECEC','text 4.5'],
['primary on nav (UI)','#DE3030','#17181C','ui 3'],
['ink on white','#17181C','#FFFFFF','text'],
['ink-2 on white','#4A4D57','#FFFFFF','text'],
['ink-3 on white','#5E616C','#FFFFFF','text'],
['ink-3 on surface-2','#5E616C','#EEEEF0','text'],
['ink-3 on bg','#5E616C','#F4F4F5','text'],
['ink-2 on bg','#4A4D57','#F4F4F5','text'],
['border-strong on white (UI)','#85888F','#FFFFFF','ui 3'],
['border-strong on bg','#85888F','#F4F4F5','ui 3'],
['nav-ink on nav','#C9CBD2','#17181C','text'],
['nav-muted on nav','#9A9DA8','#17181C','text'],
['white on nav','#FFFFFF','#17181C','text'],
['accent text on white','#9A4A06','#FFFFFF','text'],
['accent on white (UI)','#B45309','#FFFFFF','ui 3'],
['accent-ink on accent-soft','#8A3F05','#FFF4E5','text'],
['success on white','#157F3B','#FFFFFF','text'],
['success-ink on success-soft','#0F5F2C','#E8F5EC','text'],
['danger on white','#B3261E','#FFFFFF','text'],
['danger-ink on danger-soft','#8F1C13','#FCEDEB','text'],
['danger on danger-soft','#B3261E','#FCEDEB','text'],
['info-ink on info-soft','#333945','#ECEEF2','text'],
['white on danger','#FFFFFF','#B3261E','text'],
['white on success','#FFFFFF','#157F3B','text'],
['placeholder ink-3 on white','#5E616C','#FFFFFF','text'],
['white on ink (badge dark)','#FFFFFF','#17181C','text'],
['disabled text on surface-2','#6B6E78','#EEEEF0','exempt'],
['focus ring on white','#17181C','#FFFFFF','ui 3'],
['focus ring white on nav','#FFFFFF','#17181C','ui 3'],
['brand name primary on white','#DE3030','#FFFFFF','18px bold = large 3'],
];
for(const [n,f,b,req] of pairs){console.log(cr(f,b).toFixed(2).padStart(6),'  ',n.padEnd(34),f,b,req)}
}
