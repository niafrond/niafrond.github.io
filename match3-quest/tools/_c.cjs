const fs=require('fs');const m=fs.readFileSync('sprites/generated.js','utf8').match(/export const GBA_SPRITES\s*=\s*(\{[\s\S]*\});\s*$/);const s=Function('return '+m[1])();
const keys=process.argv[2].split(',');console.log(keys.filter(k=>s[k]&&!s[k].left).join(',')||'tous ont left', keys.filter(k=>!s[k]).join(','));
