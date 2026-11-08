export function adjustPixels(data:Uint8ClampedArray,brightness:number,contrast:number,saturation:number){
 const b=brightness*2.55,c=(259*(contrast+255))/(255*(259-contrast)),s=saturation/100;
 for(let i=0;i<data.length;i+=4){const gray=.2126*data[i]+.7152*data[i+1]+.0722*data[i+2];for(let k=0;k<3;k++)data[i+k]=c*(gray+(data[i+k]-gray)*s-128)+128+b;}
 return data;
}
