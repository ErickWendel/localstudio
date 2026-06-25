(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin===`use-credentials`?t.credentials=`include`:e.crossOrigin===`anonymous`?t.credentials=`omit`:t.credentials=`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=Object.freeze({float16:`float16`,float32:`float32`,uint32:`uint32`});function t(t){if(t===e.float16)return 2;if(t===e.float32||t===e.uint32)return 4;throw Error(`Unsupported dtype: ${t}`)}function n(e){if(!Array.isArray(e)||e.length===0)throw Error(`shape must be a non-empty array`);let t=1;for(let n of e){if(!Number.isInteger(n)||n<=0)throw Error(`invalid shape dimension: ${n}`);t*=n}return t}function r(e){let t=Array(e.length),n=1;for(let r=e.length-1;r>=0;--r)t[r]=n,n*=e[r];return t}var i=[`shader-f16`,`subgroups`,`chromium-experimental-subgroup-matrix`];async function a(e={}){return new s({host:e.host??await c(e)})}var o=class{constructor({runtime:e,dtype:i,shape:a,buffer:o,strides:s=r(a)}){this.runtime=e,this.dtype=i,this.shape=a,this.strides=s,this.buffer=o,this.size=n(a),this.byteLength=this.size*t(i),this.destroyed=!1}destroy(){this.destroyed||=(this.buffer?.destroy?.(),!0)}},s=class{constructor({host:e}){this.host=e,this.pipelineCache=new Map,this.bindGroupCache=new Map,this.maxBindGroupCacheEntries=4096,this.bufferIds=new WeakMap,this.nextBufferId=1,this.readbackPool=new Map,this.readbackPoolBytes=0,this.maxReadbackPoolBytes=64*1024*1024,this.destroyed=!1}caps(){return this.host.caps()}async destroy(){this.destroyed||(this.destroyed=!0,this.clearTransientCaches(),this.clearReadbackPool(),await this.host.destroy?.())}clearTransientCaches(){return{bindGroups:this.clearBindGroupCache()}}clearBindGroupCache(){let e=this.bindGroupCache.size;return this.bindGroupCache.clear(),e}clearReadbackPool(){let e=0;for(let t of this.readbackPool.values())for(let n of t)n.destroy?.(),e++;return this.readbackPool.clear(),this.readbackPoolBytes=0,e}tensorFromTypedArray(e,t,r){if(!p(e,r))throw Error(`Only float16/Uint16Array, float32/Float32Array and uint32/Uint32Array tensors are supported`);let i=n(t);if(r.length!==i)throw Error(`tensor data length ${r.length} does not match shape element count ${i}`);let a=this.host.createBuffer({label:`tensor`,size:r.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC,mappedAtCreation:!0}),s=r.constructor;return new s(a.getMappedRange()).set(r),a.unmap(),new o({runtime:this,dtype:e,shape:t,buffer:a})}allocateWeightsBuffer({byteLength:t,dtype:n,shape:r,label:i=`weights`}){if(!Object.values(e).includes(n))throw Error(`Unsupported dtype: ${n}`);if(!Number.isInteger(t)||t<0)throw Error(`byteLength must be a nonnegative integer, got ${t}`);let a=this.host.createBuffer({label:i,size:t,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});return new o({runtime:this,dtype:n,shape:r,buffer:a})}writeWeightsRange(e,t,n){if(!(e instanceof o))throw Error(`writeWeightsRange expects a BonsaiWebGpuTensor`);if(!Number.isInteger(t)||t<0)throw Error(`byteOffset must be a nonnegative integer, got ${t}`);if(t+n.byteLength>e.byteLength)throw Error(`write range [${t}, ${t+n.byteLength}] exceeds tensor byteLength ${e.byteLength}`);this.host.writeBuffer(e.buffer,t,n)}async copyBufferToBuffer({src:e,dst:t,srcOffset:n=0,dstOffset:r=0,byteLength:i,wait:a=!1}){let o=e?.buffer??e,s=t?.buffer??t,c=this.host.device.createCommandEncoder({label:`copyBufferToBuffer`});c.copyBufferToBuffer(o,n,s,r,i),await this.host.submit([c.finish()],{wait:a})}empty(r,i,a=`tensor-output`){if(!Object.values(e).includes(r))throw Error(`Unsupported dtype: ${r}`);let s=n(i)*t(r),c=this.host.createBuffer({label:a,size:s,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});return new o({runtime:this,dtype:r,shape:i,buffer:c})}readTensor(t){let n=this.#e(t.byteLength),r=this.host.device.createCommandEncoder({label:`readTensor`});r.copyBufferToBuffer(t.buffer,0,n,0,t.byteLength),this.host.device.queue.submit([r.finish()]);let{dtype:i,byteLength:a}=t;return(async()=>{let t=await this.host.mapRead(n,0,a);if(this.#t(a,n),i===e.float32)return new Float32Array(t);if(i===e.float16)return new Uint16Array(t);if(i===e.uint32)return new Uint32Array(t);throw Error(`Unsupported dtype: ${i}`)})()}createUniformU32(e,t){let n=new Uint32Array(e),r=this.host.createBuffer({label:t,size:n.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});return this.host.writeBuffer(r,0,n),r}async runProgram(e,t={}){let n=await this.#n(e),r=t.wait??!1,i=this.host.device.createCommandEncoder({label:`compute-dispatch`}),a=i.beginComputePass({label:`compute-pass`});a.setPipeline(n.pipeline),a.setBindGroup(0,n.bindGroup),a.dispatchWorkgroups(n.workgroups[0],n.workgroups[1],n.workgroups[2]),a.end(),await this.host.submit([i.finish()],{wait:r})}#e(e){let t=this.readbackPool.get(e);return t&&t.length>0?(this.readbackPoolBytes-=e,t.pop()):this.host.createBuffer({label:`tensor-readback`,size:e,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ})}#t(e,t){if(this.readbackPoolBytes+e>this.maxReadbackPoolBytes){t.destroy?.();return}let n=this.readbackPool.get(e);n||(n=[],this.readbackPool.set(e,n)),n.push(t),this.readbackPoolBytes+=e}async#n(e){let{name:t,source:n,entryPoint:r=`main`,cacheKey:i=t,bindings:a,workgroups:o}=e;if(typeof n!=`string`||n.length===0)throw Error(`program requires WGSL source`);if(!Array.isArray(a)||a.length===0)throw Error(`program requires bindings`);if(!Array.isArray(o)||o.length!==3)throw Error(`program requires a 3D workgroups array`);let s=await this.#r({name:t,source:n,entryPoint:r,cacheKey:i,layoutFactory:()=>this.#o(t,a.map(e=>e.type))});return{pipeline:s,bindGroup:this.#i({name:t,cacheKey:i,pipeline:s,bindings:a}),workgroups:o}}async#r({name:e,source:t,entryPoint:n,cacheKey:r,layoutFactory:i}){let a=this.pipelineCache.get(r);if(a)return a;let o=this.host.createShaderModule(t,e),s=await this.host.createComputePipeline({label:e,layout:i(),compute:{module:o,entryPoint:n}});return this.pipelineCache.set(r,s),s}#i({name:e,cacheKey:t,pipeline:n,bindings:r}){let i=r.map((e,t)=>{let n=e.tensor?.buffer??e.buffer,r={buffer:n,offset:e.offset??0};return e.size!==void 0&&(r.size=e.size),{binding:e.binding??t,resource:r,cachePart:`${e.binding??t}:${this.#a(n)}:${r.offset}:${r.size??``}`}}),a=`${t}|${i.map(e=>e.cachePart).join(`|`)}`,o=this.bindGroupCache.get(a);if(o===void 0&&(o=this.host.device.createBindGroup({label:`${e}-bind-group`,layout:n.getBindGroupLayout(0),entries:i.map(({binding:e,resource:t})=>({binding:e,resource:t}))}),this.bindGroupCache.set(a,o),this.bindGroupCache.size>this.maxBindGroupCacheEntries)){let e=this.bindGroupCache.keys().next().value;this.bindGroupCache.delete(e)}return o}#a(e){let t=this.bufferIds.get(e);return t===void 0&&(t=this.nextBufferId++,this.bufferIds.set(e,t)),t}#o(e,t){let n=this.host.device.createBindGroupLayout({label:`${e}-bgl`,entries:t.map((e,t)=>({binding:t,visibility:GPUShaderStage.COMPUTE,buffer:{type:e}}))});return this.host.device.createPipelineLayout({label:`${e}-layout`,bindGroupLayouts:[n]})}};async function c(e={}){let t=globalThis.navigator?.gpu;if(!t)throw Error(`WebGPU is not available in this browser context`);let n=await t.requestAdapter({powerPreference:e.powerPreference??`high-performance`});if(!n)throw Error(`No WebGPU adapter was returned`);let r=await n.requestDevice({requiredFeatures:l(n),requiredLimits:e.requiredLimits??u(n),label:e.label??`webgpu-ml-runtime`});return r.addEventListener(`uncapturederror`,e=>{console.error(`WebGPU uncaptured error:`,e.error)}),f({adapter:n,device:r,caps:d(r,n),destroy:()=>r.destroy?.()})}function l(e){let t=new Set(({}.BONSAI_DISABLE_WEBGPU_FEATURES??``).split(`,`).map(e=>e.trim()).filter(Boolean));return i.filter(n=>e.features.has(n)&&!t.has(n))}function u(e){let t={};return e.limits.maxBufferSize&&(t.maxBufferSize=Number(e.limits.maxBufferSize)),e.limits.maxStorageBufferBindingSize&&(t.maxStorageBufferBindingSize=Number(e.limits.maxStorageBufferBindingSize)),t}function d(e,t=null){let n=t?.info??{};return{adapter:{vendor:n.vendor??``,architecture:n.architecture??``,device:n.device??``,description:n.description??``},f16:e.features.has(`shader-f16`),subgroups:e.features.has(`subgroups`),subgroupMatrix:e.features.has(`chromium-experimental-subgroup-matrix`)}}function f({adapter:e,device:t,caps:n,destroy:r,gpu:i}){return{gpu:i,adapter:e,device:t,caps:()=>n,createShaderModule:(e,n)=>t.createShaderModule({code:e,label:n}),createComputePipeline:e=>t.createComputePipelineAsync(e),createBuffer:e=>t.createBuffer(e),writeBuffer:(e,n,r)=>t.queue.writeBuffer(e,n,r),submit:async(e,n={})=>{t.queue.submit(e),n.wait!==!1&&await t.queue.onSubmittedWorkDone()},mapRead:async(e,t,n)=>{await e.mapAsync(GPUMapMode.READ,t,n);let r=e.getMappedRange(t,n).slice(0);return e.unmap(),r},destroy:r}}function p(t,n){return t===e.float16&&n instanceof Uint16Array||t===e.float32&&n instanceof Float32Array||t===e.uint32&&n instanceof Uint32Array}var m=BigInt(1e8),h=new TextDecoder(`utf-8`,{fatal:!0}),g=Object.freeze({BOOL:8,F4:4,F6_E2M3:6,F6_E3M2:6,U8:8,I8:8,F8_E5M2:8,F8_E4M3:8,F8_E8M0:8,F8_E4M3FNUZ:8,F8_E5M2FNUZ:8,I16:16,U16:16,F16:16,BF16:16,I32:32,U32:32,F32:32,F64:64,I64:64,U64:64,C64:64});function _(e){let t=g[e];if(!t)throw new v(`Unknown dtype: ${e}`);return t}var v=class extends Error{constructor(e){super(e),this.name=`SafeTensorsError`}};function y(e){if(e.byteLength<8)throw new v(`File too small: ${e.byteLength} bytes < 8 byte header prefix`);let t=new DataView(e.buffer,e.byteOffset,e.byteLength).getBigUint64(0,!0);if(t>m)throw new v(`Header length ${t} exceeds maximum 100000000`);let n=Number(t),r=8+n;if(r>e.byteLength)throw new v(`Header length ${n} exceeds buffer size`);let i=e.subarray(8,r),a;try{a=h.decode(i)}catch{throw new v(`Header is not valid UTF-8`)}let o;try{o=JSON.parse(a)}catch(e){throw new v(`Header is not valid JSON: ${e.message}`)}if(typeof o!=`object`||!o||Array.isArray(o))throw new v(`Header must be a JSON object`);return{headerByteLength:n,dataStart:r,header:o}}function b(e,t){let n=e.__metadata__;if(n!==void 0&&!S(n))throw new v(`__metadata__ must be a {string: string} map`);let r=[];for(let[t,n]of Object.entries(e))t!==`__metadata__`&&r.push([t,x(t,n)]);r.sort((e,t)=>e[1].dataOffsets[0]-t[1].dataOffsets[0]);let i=0;for(let[e,t]of r){let[n,r]=t.dataOffsets;if(n!==i)throw new v(`Invalid offset for tensor ${e}: expected ${i}, got ${n}`);let a=t.elementCount*_(t.dtype);if(a%8!=0)throw new v(`Tensor ${e} has subbyte size ${a} bits not divisible by 8`);if(r-n!==a/8)throw new v(`Tensor ${e} byte length ${r-n} does not match shape*dtype ${a/8}`);i=r}if(t!==null&&i!==t)throw new v(`Data length mismatch: header expects ${i} bytes, got ${t}`);return{metadata:n??null,tensors:new Map(r),dataByteLength:i}}function x(e,t){if(typeof t!=`object`||!t||Array.isArray(t))throw new v(`Tensor ${e}: info must be an object`);let{dtype:n,shape:r,data_offsets:i}=t;if(!(n in g))throw new v(`Tensor ${e}: unknown dtype ${n}`);if(!Array.isArray(r)||!r.every(e=>Number.isInteger(e)&&e>=0))throw new v(`Tensor ${e}: shape must be an array of nonnegative integers`);if(!Array.isArray(i)||i.length!==2||!i.every(e=>Number.isInteger(e)&&e>=0))throw new v(`Tensor ${e}: data_offsets must be a 2-element array of nonnegative integers`);let[a,o]=i;if(o<a)throw new v(`Tensor ${e}: data_offsets end < begin`);let s=1;for(let t of r)if(s*=t,!Number.isSafeInteger(s))throw new v(`Tensor ${e}: shape product exceeds Number.MAX_SAFE_INTEGER`);return{dtype:n,shape:[...r],dataOffsets:[a,o],elementCount:s}}function S(e){if(typeof e!=`object`||!e||Array.isArray(e))return!1;for(let t of Object.values(e))if(typeof t!=`string`)return!1;return!0}var C=262144,w=128<<20,T=1<<20,E=4,D=`safetensors-cache-v1`,O=`chunks`,k=`meta`;async function A(e,t={}){return j(e,t,P)}async function j(e,t,n){let r=t.cacheKey??(typeof e==`string`?e:e.toString()),i=t.cache===!1,a=!!t.force,o=i||t.source?null:t.chunkCache??ee(t.cacheName??D);if(o&&!a)try{let i=await o.getMeta?.(r);if(i&&i.header&&Number.isFinite(i.size)&&Number.isFinite(i.dataStart)){let r=await n(e,{...t,chunkCache:o,knownSize:i.size,knownAcceptsRanges:i.acceptsRanges??!0}),a=i.size-i.dataStart,{metadata:s,tensors:c}=b(i.header,a);return new M({source:r,dataStart:i.dataStart,metadata:s,tensors:c,headerByteLength:i.dataStart-8,dataLength:a})}}catch(e){typeof console<`u`&&console.warn(`safetensors meta cache read failed: ${e.message}`)}let s=await n(e,{...t,chunkCache:o}),c=t.headerProbeBytes??C,l=s.size==null?c:Math.min(c,s.size),u=await s.readRange(0,l);if(u.byteLength<8)throw new v(`Probe returned ${u.byteLength} bytes; need at least 8`);let d=new DataView(u.buffer,u.byteOffset,u.byteLength).getBigUint64(0,!0);if(d>BigInt(1e8))throw new v(`Header length ${d} exceeds maximum 100000000`);let f=Number(d),p=8+f,m;if(u.byteLength>=p)m=u.subarray(0,p);else{let e=await s.readRange(u.byteLength,p);m=new Uint8Array(p),m.set(u),m.set(e,u.byteLength)}let{header:h}=y(m),g=s.size==null?null:s.size-p,{metadata:_,tensors:x}=b(h,g);return o&&!a&&s.size!=null&&o.putMeta?.(r,{size:s.size,dataStart:p,header:h,acceptsRanges:s.acceptsRanges}).catch?.(()=>{}),new M({source:s,dataStart:p,metadata:_,tensors:x,headerByteLength:f,dataLength:g})}var M=class{#e;#t;#n;constructor({source:e,dataStart:t,metadata:n,tensors:r,headerByteLength:i,dataLength:a}){this.#e=e,this.#t=t,this.#n=r,this.metadata=n,this.url=e.url,this.totalSize=e.size,this.headerByteLength=i,this.dataByteLength=a}names(){return[...this.#n.keys()]}has(e){return this.#n.has(e)}info(e){let t=this.#r(e);return{dtype:t.dtype,shape:[...t.shape],dataOffsets:[...t.dataOffsets]}}byteLength(e){let t=this.#r(e);return t.dataOffsets[1]-t.dataOffsets[0]}async tensorBytes(e,t){let[n,r]=this.#r(e).dataOffsets;return this.#e.readRange(this.#t+n,this.#t+r,t)}async streamAll(e,{concurrency:t=E,chunkMaxBytes:n=w,chunkMaxGap:r=T,names:i=null,onProgress:a,signal:o}={}){let s=i==null?null:new Set(i);if(s&&s.size===0)return;if(s){for(let e of s)if(!this.#n.has(e))throw new v(`Unknown tensor: ${e}`)}let c=[];for(let[e,t]of this.#n){if(s&&!s.has(e))continue;let[n,r]=t.dataOffsets;r>n&&c.push({name:e,begin:n,end:r})}if(c.sort((e,t)=>e.begin-t.begin),c.length===0)return;let l=N(c,{maxBytes:n,maxGap:r}),u=l.reduce((e,t)=>e+(t.end-t.begin),0),d=0,f=new Map,p=(e={})=>{if(!a)return;let t=d;for(let e of f.values())t+=e;a({loaded:t,total:u,...e})},m=this.#t,h=this.#e;h.writeCachedChunk?.bind(h);let g=0,_=h.readTensor?.bind(h)||null,y=h.writeTensor?.bind(h)||null,b=async t=>{let{begin:n,end:r,tensors:i}=l[t],a=m+n,s=m+r,c=r-n,u=null,g=!0,v=_?await Promise.all(i.map(e=>_(m+e.begin,m+e.end))):i.map(()=>null);for(let e of v)if(!e){g=!1;break}if(g){u=new Uint8Array(c);for(let e=0;e<i.length;++e)u.set(v[e],i[e].begin-n)}else f.set(t,0),u=await h.readRange(a,s,{signal:o,onByteProgress:e=>{f.set(t,(f.get(t)??0)+e),p({fromCache:!1,range:[a,s],inFlight:!0})}});let b=g,x=i.map(e=>({name:e.name,offset:e.begin-n,length:e.end-e.begin})),S=e({begin:a,end:s,bytes:u,tensors:x}),C=!b&&y?Promise.all(i.map((e,t)=>{if(v[t])return null;let r=u.subarray(e.begin-n,e.end-n);return y(m+e.begin,m+e.end,r).catch(()=>{})})).catch(()=>{}):Promise.resolve();await Promise.all([S,C]),f.delete(t),d+=c,p({fromCache:b,range:[a,s]})},x=async()=>{for(;;){if(o?.aborted)throw o.reason??Error(`aborted`);let e=g++;if(e>=l.length)return;await b(e)}},S=[];for(let e=0;e<Math.min(t,l.length);++e)S.push(x());await Promise.all(S)}async close(){await this.#e.close?.()}#r(e){let t=this.#n.get(e);if(!t)throw new v(`Unknown tensor: ${e}`);return t}};function N(e,{maxBytes:t,maxGap:n}){let r=[],i=null;for(let a of e){if(!i){i={begin:a.begin,end:a.end,tensors:[a]};continue}let e=a.begin-i.end,o=a.end-i.begin;e<=n&&o<=t?(i.end=a.end,i.tensors.push(a)):(r.push(i),i={begin:a.begin,end:a.end,tensors:[a]})}return i&&r.push(i),r}async function P(e,t){let n=e instanceof URL?e.toString():String(e);if(!/^https?:/i.test(n))throw new v(`Expected http(s) safetensors URL, got: ${n}`);return F(n,t)}async function F(e,t){let n=t.fetch??globalThis.fetch;if(typeof n!=`function`)throw new v(`No fetch implementation available; pass options.fetch`);let r=!!(t.requireRangeRequests??t.requireRanges??!1),i,a;if(t.knownSize!=null)i=t.knownSize,a=t.knownAcceptsRanges!==!1;else{let r=await n(e,{method:`HEAD`,signal:t.signal});if(!r.ok)throw new v(`HEAD ${e} failed: ${r.status} ${r.statusText}`);let o=r.headers.get(`content-length`);if(a=(r.headers.get(`accept-ranges`)??``).toLowerCase().includes(`bytes`),i=o===null?null:Number(o),o!==null&&!Number.isFinite(i))throw new v(`Invalid content-length header: ${o}`)}if(r&&!a)throw new v(`Range requests are required for ${e}, but the server did not advertise Accept-Ranges: bytes`);let o=t.cacheKey??e,s=t.cache===!1,c=!!t.force,l=t.chunkCache===void 0?s?null:ee(t.cacheName??D):t.chunkCache;return{url:e,size:i,acceptsRanges:a,async readRange(i,o,s={}){if(i===o)return new Uint8Array;let c=s.signal??t.signal,l=s.onByteProgress??null;if(a){let t=await n(e,{headers:{Range:`bytes=${i}-${o-1}`},signal:c});if(t.status!==206&&t.status!==200)throw new v(`Range ${i}-${o-1} of ${e} failed: ${t.status}`);let a=await L(t,o-i,l);if(t.status===200){if(r)throw new v(`Range ${i}-${o-1} of ${e} returned 200 instead of 206; refusing full-response fallback`);return a.subarray(i,o)}if(a.byteLength!==o-i)throw new v(`Range ${i}-${o-1} returned ${a.byteLength} bytes`);return a}let u=await n(e,{signal:c});if(!u.ok)throw new v(`GET ${e} failed: ${u.status}`);return(await L(u,null,l)).subarray(i,o)},async readTensor(e,t){if(!l||c)return null;try{return await l.get(o,e,t)}catch(e){return typeof console<`u`&&console.warn(`safetensors cache read failed: ${e.message}`),null}},async writeTensor(e,t,n){if(l)try{let r=n.byteOffset===0&&n.byteLength===n.buffer.byteLength?n:new Uint8Array(n);await l.put(o,e,t,r)}catch(e){typeof console<`u`&&console.warn(`safetensors cache write failed: ${e.message}`)}}}}var I=new Map;function ee(e){return typeof indexedDB>`u`?null:{async get(t,n,r){let i=await te(e);return new Promise((e,a)=>{let o=i.transaction(O,`readonly`).objectStore(O).get([t,n,r]);o.onsuccess=async()=>{let t=o.result;if(!t)return e(null);e(new Uint8Array(await t.arrayBuffer()))},o.onerror=()=>a(o.error)})},async put(t,n,r,i){let a=await te(e);return new Promise((e,o)=>{let s=a.transaction(O,`readwrite`).objectStore(O).put(new Blob([i]),[t,n,r]);s.onsuccess=()=>e(),s.onerror=()=>o(s.error)})},async getMeta(t){let n=await te(e);return new Promise((e,r)=>{let i=n.transaction(k,`readonly`).objectStore(k).get(t);i.onsuccess=()=>e(i.result??null),i.onerror=()=>r(i.error)})},async putMeta(t,n){let r=await te(e);return new Promise((e,i)=>{let a=r.transaction(k,`readwrite`).objectStore(k).put(n,t);a.onsuccess=()=>e(),a.onerror=()=>i(a.error)})}}}async function L(e,t,n){if(!n||!e.body?.getReader){let t=await e.arrayBuffer();return new Uint8Array(t)}let r=e.body.getReader();if(Number.isFinite(t)&&t>0){let e=new Uint8Array(t),i=0;for(;;){let{done:t,value:a}=await r.read();if(t)break;e.set(a,i),i+=a.byteLength,n(a.byteLength)}return i===t?e:e.subarray(0,i)}let i=[],a=0;for(;;){let{done:e,value:t}=await r.read();if(e)break;i.push(t),a+=t.byteLength,n(t.byteLength)}if(i.length===1)return i[0];let o=new Uint8Array(a),s=0;for(let e of i)o.set(e,s),s+=e.byteLength;return o}function te(e){if(I.has(e))return I.get(e);let t=new Promise((t,n)=>{let r=indexedDB.open(e,2);r.onupgradeneeded=e=>{let t=r.result;t.objectStoreNames.contains(O)||t.createObjectStore(O),t.objectStoreNames.contains(k)||t.createObjectStore(k)},r.onsuccess=()=>t(r.result),r.onerror=()=>n(r.error),r.onblocked=()=>n(Error(`indexedDB open blocked`))});return I.set(e,t),t}var R=class{constructor(e){this.trie=this._build_trie(e)}_build_trie(e){let t=Object.create(null);for(let n of e){let e=t;for(let t=0;t<n.length;++t){let r=n[t];e=e[r]??=Object.create(null)}e.end=n}return t}split(e){let t=[],n=e.length,r=0,i=0;for(;i<n;){let a=this.trie,o=null,s=i;for(;s<n&&(a=a[e[s]]);)a.end&&(o=a.end),++s;o?(i>r&&t.push(e.slice(r,i)),t.push(o),i+=o.length,r=i):++i}return r<n&&t.push(e.slice(r)),t}},ne=class{constructor(e){this.content=e.content,this.id=e.id,this.single_word=e.single_word??!1,this.lstrip=e.lstrip??!1,this.rstrip=e.rstrip??!1,this.special=e.special??!1,this.normalized=e.normalized??!this.special}},re=(()=>{let e=[...Array.from({length:94},(e,t)=>t+33),...Array.from({length:12},(e,t)=>t+161),...Array.from({length:82},(e,t)=>t+174)],t=e.slice(),n=0;for(let r=0;r<256;++r)e.includes(r)||(e.push(r),t.push(256+n),n+=1);let r=t.map(e=>String.fromCharCode(e));return Object.fromEntries(e.map((e,t)=>[e,r[t]]))})(),ie=(e=>Object.fromEntries(Object.entries(e).map(([e,t])=>[t,e])))(re),ae=`.,!?…。，、।۔،`,oe=new Map([[`(?i:'s|'t|'re|'ve|'m|'ll|'d)`,`(?:'([sS]|[tT]|[rR][eE]|[vV][eE]|[mM]|[lL][lL]|[dD]))`],[`(?i:[sdmt]|ll|ve|re)`,`(?:[sS]|[dD]|[mM]|[tT]|[lL][lL]|[vV][eE]|[rR][eE])`],[`[^\\r\\n\\p{L}\\p{N}]?+`,`[^\\r\\n\\p{L}\\p{N}]?`],[`[^\\s\\p{L}\\p{N}]++`,`[^\\s\\p{L}\\p{N}]+`],[`(?>\\p{Nd}{510})`,`(?:\\p{Nd}{510})`],[`\\p{Nd}{3}+`,`(?:\\p{Nd}{3})+`],[`\\G`,``],[` ?[^(\\s|[${ae}])]+`,` ?[^\\s${ae}]+`]]),se=`\\p{P}\\u0021-\\u002F\\u003A-\\u0040\\u005B-\\u0060\\u007B-\\u007E`,ce=e=>e.replace(/ \./g,`.`).replace(/ \?/g,`?`).replace(/ \!/g,`!`).replace(/ ,/g,`,`).replace(/ \' /g,`'`).replace(/ n't/g,`n't`).replace(/ 'm/g,`'m`).replace(/ 's/g,`'s`).replace(/ 've/g,`'ve`).replace(/ 're/g,`'re`),le=(e,t=!0)=>{if(e.Regex!==void 0){let t=e.Regex.replace(/\\([#&~])/g,`$1`);t=t.replace(/\\A/g,`^`).replace(/\\z/g,`$`).replace(/\\Z/g,`(?=\\r?\\n?$)`);for(let[e,n]of oe)t=t.replaceAll(e,n);try{return new RegExp(t,`gu`)}catch(e){if(!(e instanceof SyntaxError)||!e.message.toLowerCase().includes(`invalid property name`))throw e;let n=!1,r=t.replace(/(\\[pP])\{([^}=]+)\}/g,(e,t,r)=>{try{return RegExp(`\\p{${r}}`,`u`),`${t}{${r}}`}catch{return n=!0,`${t}{Script=${r}}`}});if(!n)throw e;try{return new RegExp(r,`gu`)}catch{throw e}}}else if(e.String!==void 0){let n=ue(e.String);return new RegExp(t?n:`(${n})`,`gu`)}else return console.warn(`Unknown pattern type:`,e),null},ue=e=>e.replace(/[.*+?^${}()|[\]\\]/g,`\\$&`),de=(e,t,n)=>{let r=[],i=0;for(;i<e.length;){if(r.push(e[i]),(t.get(e[i])??n)!==n){++i;continue}for(;++i<e.length&&(t.get(e[i])??n)===n;)t.get(r.at(-1))!==n&&(r[r.length-1]+=e[i])}return r},fe=e=>e>=19968&&e<=40959||e>=13312&&e<=19903||e>=131072&&e<=173791||e>=173824&&e<=177983||e>=177984&&e<=178207||e>=178208&&e<=183983||e>=63744&&e<=64255||e>=194560&&e<=195103,pe=e=>Number.isInteger(e)||typeof e==`bigint`,me=e=>{let t=0;for(let n of e)++t;return t},he=e=>ve(e.toLowerCase()),z=(...e)=>Array.prototype.concat.apply([],e),ge=e=>new Map(Object.entries(e)),_e=(e,t)=>{let n=[],r=0;for(let i of e.matchAll(t)){let t=i[0];r<i.index&&n.push(e.slice(r,i.index)),t.length>0&&n.push(t),r=i.index+t.length}return r<e.length&&n.push(e.slice(r)),n},ve=e=>e.replace(/\p{M}/gu,``),B=(e,t,n=[])=>{if(!e||Array.isArray(e)||typeof e!=`object`)return`${t} must be a valid object`;for(let r of n)if(!(r in e))return`${t} must contain a "${r}" property`;return null},ye=e=>e.match(/\S+/g)||[],V=class{constructor(){let e=function(...t){return e._call(...t)};return Object.setPrototypeOf(e,new.target.prototype)}},H=class extends V{constructor(e){super(),this.config=e}_call(e){return this.normalize(e)}},be=class extends H{tokenize_chinese_chars(e){let t=[];for(let n=0;n<e.length;++n){let r=e[n];fe(r.charCodeAt(0))?(t.push(` `),t.push(r),t.push(` `)):t.push(r)}return t.join(``)}strip_accents(e){return e.normalize(`NFD`).replace(/\p{Mn}/gu,``)}is_control(e){switch(e){case`	`:case`
`:case`\r`:return!1;default:return/^\p{Cc}|\p{Cf}|\p{Co}|\p{Cs}$/u.test(e)}}clean_text(e){let t=[];for(let n of e){let e=n.charCodeAt(0);e===0||e===65533||this.is_control(n)||(/^\s$/.test(n)?t.push(` `):t.push(n))}return t.join(``)}normalize(e){return this.config.clean_text&&(e=this.clean_text(e)),this.config.handle_chinese_chars&&(e=this.tokenize_chinese_chars(e)),this.config.lowercase?(e=e.toLowerCase(),this.config.strip_accents!==!1&&(e=this.strip_accents(e))):this.config.strip_accents&&(e=this.strip_accents(e)),e}},xe=class extends H{constructor(e){super(e),this.charsmap=e.precompiled_charsmap??null}normalize(e){return e=e.replace(/[\u0001-\u0008\u000B\u000E-\u001F\u007F\u008F\u009F]/gm,``),e=e.replace(/[\u0009\u000A\u000C\u000D\u00A0\u1680\u2000-\u200F\u2028\u2029\u202F\u205F\u2581\u3000\uFEFF\uFFFD]/gm,` `),e=e.includes(`～`)?e.split(`～`).map(e=>e.normalize(`NFKC`)).join(`～`):e.normalize(`NFKC`),e}},Se=class extends H{constructor(e){super(e),this.normalizers=(e.normalizers??[]).map(e=>Pe(e))}normalize(e){return this.normalizers.reduce((e,t)=>t?t.normalize(e):e,e)}},Ce=class extends H{normalize(e){let t=le(this.config.pattern??{});return t===null?e:e.replaceAll(t,this.config.content??``)}},we=class extends H{constructor(){super(...arguments),this.form=`NFC`}normalize(e){return e=e.normalize(this.form),e}},Te=class extends we{constructor(){super(...arguments),this.form=`NFC`}},Ee=class extends we{constructor(){super(...arguments),this.form=`NFD`}},De=class extends we{constructor(){super(...arguments),this.form=`NFKC`}},Oe=class extends we{constructor(){super(...arguments),this.form=`NFKD`}},ke=class extends H{normalize(e){return this.config.strip_left&&this.config.strip_right?e=e.trim():(this.config.strip_left&&(e=e.trimStart()),this.config.strip_right&&(e=e.trimEnd())),e}},Ae=class extends H{normalize(e){return ve(e)}},je=class extends H{normalize(e){return e.toLowerCase()}},Me=class extends H{normalize(e){return e=this.config.prepend+e,e}};function Ne(e){if(e===null)return null;switch(e.type){case`BertNormalizer`:return new be(e);case`Precompiled`:return new xe(e);case`Sequence`:return new Se(e);case`Replace`:return new Ce(e);case`NFC`:return new Te(e);case`NFD`:return new Ee(e);case`NFKC`:return new De(e);case`NFKD`:return new Oe(e);case`Strip`:return new ke(e);case`StripAccents`:return new Ae(e);case`Lowercase`:return new je(e);case`Prepend`:return new Me(e);default:throw Error(`Unknown Normalizer type: ${e.type}`)}}var Pe=Ne,Fe=class extends V{pre_tokenize(e,t){return(Array.isArray(e)?e.map(e=>this.pre_tokenize_text(e,t)):this.pre_tokenize_text(e,t)).flat()}_call(e,t){return this.pre_tokenize(e,t)}},Ie=class extends Fe{constructor(e){super(),this.config=e,this.add_prefix_space=this.config.add_prefix_space??!1,this.trim_offsets=this.config.trim_offsets??!1,this.use_regex=this.config.use_regex??!0,this.pattern=/'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu,this.byte_encoder=re,this.text_encoder=new TextEncoder}pre_tokenize_text(e,t){return this.add_prefix_space&&!e.startsWith(` `)&&(e=` `+e),(this.use_regex?e.match(this.pattern)||[]:[e]).map(e=>Array.from(this.text_encoder.encode(e),e=>this.byte_encoder[e]).join(``))}},Le=class extends Fe{pre_tokenize_text(e,t){return e.match(/\w+|[^\w\s]+/g)||[]}},Re=class extends Fe{constructor(e){super(),this.replacement=e.replacement??`▁`,this.str_rep=e.str_rep||this.replacement,this.prepend_scheme=e.prepend_scheme??`always`}pre_tokenize_text(e,t){let{section_index:n=void 0}=t??{},r=e.replaceAll(` `,this.str_rep);return!r.startsWith(this.replacement)&&(this.prepend_scheme===`always`||this.prepend_scheme===`first`&&n===0)&&(r=this.str_rep+r),[r]}},ze=class extends Fe{constructor(e){super(),this.config=e,this.pattern=le(this.config.pattern??{},this.config.invert??!0)}pre_tokenize_text(e){return this.pattern===null?[]:this.config.invert?e.match(this.pattern)||[]:this.config.behavior?.toLowerCase()===`removed`?e.split(this.pattern).filter(e=>e):_e(e,this.pattern)}},Be=class extends Fe{constructor(e){super(),this.config=e,this.pattern=RegExp(`[^${se}]+|[${se}]+`,`gu`)}pre_tokenize_text(e){return e.match(this.pattern)||[]}},Ve=class extends Fe{constructor(e){super(),this.config=e;let t=`[^\\d]+|\\d${this.config.individual_digits?``:`+`}`;this.pattern=new RegExp(t,`gu`)}pre_tokenize_text(e){return e.match(this.pattern)||[]}},He=class extends Fe{constructor(){super(),this.pattern=RegExp(`[^\\s${se}]+|[${se}]`,`gu`)}pre_tokenize_text(e,t){return e.trim().match(this.pattern)||[]}},Ue=class extends Fe{constructor(e){super(),this.config=e,this.pattern=le(this.config.pattern??{}),this.content=this.config.content??``}pre_tokenize_text(e){return this.pattern===null?[e]:[e.replaceAll(this.pattern,this.config.content??``)]}},We=class extends Fe{constructor(e){super(),this.tokenizers=(e.pretokenizers??[]).map(e=>Je(e))}pre_tokenize_text(e,t){return this.tokenizers.reduce((e,n)=>n?n.pre_tokenize(e,t):e,[e])}},Ge=class extends Fe{pre_tokenize_text(e){return ye(e)}},Ke=class extends Fe{constructor(e){super(),this.config=e,this._length=e.length}pre_tokenize_text(e){let t=[];for(let n=0;n<e.length;n+=this._length)t.push(e.slice(n,n+this._length));return t}};function qe(e){if(e===null)return null;switch(e.type){case`BertPreTokenizer`:return new He;case`Sequence`:return new We(e);case`Whitespace`:return new Le;case`WhitespaceSplit`:return new Ge;case`Metaspace`:return new Re(e);case`ByteLevel`:return new Ie(e);case`Split`:return new ze(e);case`Punctuation`:return new Be(e);case`Digits`:return new Ve(e);case`Replace`:return new Ue(e);case`FixedLength`:return new Ke(e);default:throw Error(`Unknown PreTokenizer type: ${e.type}`)}}var Je=qe,Ye=class extends V{constructor(e){super(),this.config=e,this.vocab=[],this.tokens_to_ids=new Map,this.unk_token_id=void 0,this.unk_token=void 0,this.end_of_word_suffix=void 0,this.fuse_unk=this.config.fuse_unk??!1}_call(e){let t=this.encode(e);return this.fuse_unk&&(t=de(t,this.tokens_to_ids,this.unk_token_id)),t}},Xe=class extends Ye{constructor(e){super(e),this.max_input_chars_per_word=100,this.tokens_to_ids=ge(e.vocab),this.unk_token_id=this.tokens_to_ids.get(e.unk_token),this.unk_token=e.unk_token,this.max_input_chars_per_word=e.max_input_chars_per_word??100,this.vocab=Array(this.tokens_to_ids.size);for(let[e,t]of this.tokens_to_ids)this.vocab[t]=e}encode(e){let t=[];for(let n of e){let e=[...n];if(e.length>this.max_input_chars_per_word){t.push(this.unk_token);continue}let r=!1,i=0,a=[];for(;i<e.length;){let t=e.length,n=null;for(;i<t;){let r=e.slice(i,t).join(``);if(i>0&&(r=this.config.continuing_subword_prefix+r),this.tokens_to_ids.has(r)){n=r;break}--t}if(n===null){r=!0;break}a.push(n),i=t}r?t.push(this.unk_token):t.push(...a)}return t}},Ze=class e{constructor(e,t){this.is_leaf=e,this.children=t}static default(){return new e(!1,new Map)}},Qe=class{constructor(){this.root=Ze.default()}extend(e){for(let t of e)this.push(t)}push(e){let t=this.root;for(let n of e){let e=t.children.get(n);e===void 0&&(e=Ze.default(),t.children.set(n,e)),t=e}t.is_leaf=!0}*common_prefix_search(e){let t=this.root;if(t===void 0)return;let n=``;for(let r of e){if(n+=r,t=t.children.get(r),t===void 0)return;t.is_leaf&&(yield n)}}},$e=class e{constructor(e,t,n,r,i){this.token_id=e,this.node_id=t,this.pos=n,this.length=r,this.score=i,this.prev=null,this.backtrace_score=0}clone(){let t=new e(this.token_id,this.node_id,this.pos,this.length,this.score);return t.prev=this.prev,t.backtrace_score=this.backtrace_score,t}},et=class{constructor(e,t,n){this.chars=Array.from(e),this.len=this.chars.length,this.bos_token_id=t,this.eos_token_id=n,this.nodes=[],this.begin_nodes=Array.from({length:this.len+1},()=>[]),this.end_nodes=Array.from({length:this.len+1},()=>[]);let r=new $e(this.bos_token_id??0,0,0,0,0),i=new $e(this.eos_token_id??0,1,this.len,0,0);this.nodes.push(r.clone()),this.nodes.push(i.clone()),this.begin_nodes[this.len].push(i),this.end_nodes[0].push(r)}insert(e,t,n,r){let i=this.nodes.length,a=new $e(r,i,e,t,n);this.begin_nodes[e].push(a),this.end_nodes[e+t].push(a),this.nodes.push(a)}viterbi(){let e=this.len,t=0;for(;t<=e;){if(this.begin_nodes[t].length==0)return[];for(let e of this.begin_nodes[t]){e.prev=null;let n=0,r=null;for(let i of this.end_nodes[t]){let t=i.backtrace_score+e.score;(r===null||t>n)&&(r=i.clone(),n=t)}if(r!==null)e.prev=r,e.backtrace_score=n;else return[]}++t}let n=[],r=this.begin_nodes[e][0].prev;if(r===null)return[];let i=r.clone();for(;i.prev!==null;)n.push(i.clone()),i=i.clone().prev.clone();return n.reverse(),n}piece(e){return this.chars.slice(e.pos,e.pos+e.length).join(``)}tokens(){return this.viterbi().map(e=>this.piece(e))}token_ids(){return this.viterbi().map(e=>e.token_id)}};function tt(e){if(e.length===0)throw Error(`Array must not be empty`);let t=e[0],n=0;for(let r=1;r<e.length;++r)e[r]<t&&(t=e[r],n=r);return[t,n]}var nt=class extends Ye{constructor(e,t){super(e);let n=e.vocab.length;this.vocab=Array(n),this.scores=Array(n);for(let t=0;t<n;++t)[this.vocab[t],this.scores[t]]=e.vocab[t];this.unk_token_id=e.unk_id,this.unk_token=this.vocab[e.unk_id],this.tokens_to_ids=new Map(this.vocab.map((e,t)=>[e,t])),this.bos_token=` `,this.bos_token_id=this.tokens_to_ids.get(this.bos_token),this.eos_token=t,this.eos_token_id=this.tokens_to_ids.get(this.eos_token),this.unk_token=this.vocab[this.unk_token_id],this.min_score=tt(this.scores)[0],this.unk_score=this.min_score-10,this.scores[this.unk_token_id]=this.unk_score,this.trie=new Qe,this.trie.extend(this.vocab),this.fuse_unk=!0}populate_nodes(e){let t=e.chars,n=0;for(;n<t.length;){let r=!1,i=[],a=t.slice(n).join(``),o=this.trie.common_prefix_search(a);for(let t of o){i.push(t);let a=this.tokens_to_ids.get(t),o=this.scores[a],s=me(t);e.insert(n,s,o,a),!r&&s===1&&(r=!0)}r||e.insert(n,1,this.unk_score,this.unk_token_id),n+=1}}tokenize(e){let t=new et(e,this.bos_token_id,this.eos_token_id);return this.populate_nodes(t),t.tokens()}encode(e){let t=[];for(let n of e){let e=this.tokenize(n);t.push(...e)}return t}},rt=class{constructor(e=(e,t)=>e>t,t=1/0){this._heap=[],this._comparator=e,this._max_size=t}get size(){return this._heap.length}is_empty(){return this.size===0}peek(){return this._heap[0]}push(...e){return this.extend(e)}extend(e){for(let t of e)if(this.size<this._max_size)this._heap.push(t),this._sift_up();else{let e=this._smallest();this._comparator(t,this._heap[e])&&(this._heap[e]=t,this._sift_up_from(e))}return this.size}pop(){let e=this.peek(),t=this.size-1;return t>0&&this._swap(0,t),this._heap.pop(),this._sift_down(),e}replace(e){let t=this.peek();return this._heap[0]=e,this._sift_down(),t}_parent(e){return(e+1>>>1)-1}_left(e){return(e<<1)+1}_right(e){return e+1<<1}_greater(e,t){return this._comparator(this._heap[e],this._heap[t])}_swap(e,t){let n=this._heap[e];this._heap[e]=this._heap[t],this._heap[t]=n}_sift_up(){this._sift_up_from(this.size-1)}_sift_up_from(e){for(;e>0&&this._greater(e,this._parent(e));)this._swap(e,this._parent(e)),e=this._parent(e)}_sift_down(){let e=0;for(;this._left(e)<this.size&&this._greater(this._left(e),e)||this._right(e)<this.size&&this._greater(this._right(e),e);){let t=this._right(e)<this.size&&this._greater(this._right(e),this._left(e))?this._right(e):this._left(e);this._swap(e,t),e=t}}_smallest(){return 2**Math.floor(Math.log2(this.size))-1}},it=class{constructor(e){this.capacity=e,this.cache=new Map}get(e){if(!this.cache.has(e))return;let t=this.cache.get(e);return this.cache.delete(e),this.cache.set(e,t),t}put(e,t){this.cache.has(e)&&this.cache.delete(e),this.cache.set(e,t),this.cache.size>this.capacity&&this.cache.delete(this.cache.keys().next().value)}clear(){this.cache.clear()}},at=class extends Ye{constructor(e){super(e),this.tokens_to_ids=ge(e.vocab),this.unk_token_id=this.tokens_to_ids.get(e.unk_token),this.unk_token=e.unk_token,this.vocab=Array(this.tokens_to_ids.size);for(let[e,t]of this.tokens_to_ids)this.vocab[t]=e;let t=Array.isArray(e.merges[0]);this.merges=t?e.merges:e.merges.map(e=>e.split(` `,2)),this.bpe_ranks=new Map(this.merges.map((e,t)=>[JSON.stringify(e),t])),this.end_of_word_suffix=e.end_of_word_suffix,this.continuing_subword_suffix=e.continuing_subword_suffix??null,this.byte_fallback=this.config.byte_fallback??!1,this.byte_fallback&&(this.text_encoder=new TextEncoder),this.ignore_merges=this.config.ignore_merges??!1,this.max_length_to_cache=256,this.cache_capacity=1e4,this.cache=new it(this.cache_capacity)}clear_cache(){this.cache.clear()}bpe(e){if(e.length===0)return[];let t=this.cache.get(e);if(t!==void 0)return t;let n=Array.from(e);this.end_of_word_suffix&&(n[n.length-1]+=this.end_of_word_suffix);let r=[];if(n.length>1){let e=new rt((e,t)=>e.score<t.score),t={token:n[0],bias:0,prev:null,next:null},i=t;for(let t=1;t<n.length;++t){let r={bias:t/n.length,token:n[t],prev:i,next:null};i.next=r,this.add_node(e,i),i=r}for(;!e.is_empty();){let n=e.pop();if(n.deleted||!n.next||n.next.deleted)continue;if(n.deleted=!0,n.next.deleted=!0,n.prev){let e={...n.prev};n.prev.deleted=!0,n.prev=e,e.prev?e.prev.next=e:t=e}let r={token:n.token+n.next.token,bias:n.bias,prev:n.prev,next:n.next.next};r.prev?(r.prev.next=r,this.add_node(e,r.prev)):t=r,r.next&&(r.next.prev=r,this.add_node(e,r))}for(let e=t;e!==null;e=e.next)r.push(e.token)}else r=n;if(this.continuing_subword_suffix)for(let e=0;e<r.length-1;++e)r[e]+=this.continuing_subword_suffix;return e.length<this.max_length_to_cache&&this.cache.put(e,r),r}add_node(e,t){let n=this.bpe_ranks.get(JSON.stringify([t.token,t.next.token]));n!==void 0&&(t.score=n+t.bias,e.push(t))}encode(e){let t=[];for(let n of e){if(this.ignore_merges&&this.tokens_to_ids.has(n)){t.push(n);continue}let e=this.bpe(n);for(let n of e)if(this.tokens_to_ids.has(n))t.push(n);else if(this.byte_fallback){let e=Array.from(this.text_encoder.encode(n)).map(e=>`<0x${e.toString(16).toUpperCase().padStart(2,`0`)}>`);e.every(e=>this.tokens_to_ids.has(e))?t.push(...e):this.unk_token!=null&&t.push(this.unk_token)}else this.unk_token!=null&&t.push(this.unk_token)}return t}},ot=class extends Ye{constructor(e,t){super(e);let n=e.vocab;this.tokens_to_ids=ge(t.target_lang?n[t.target_lang]:n),this.bos_token=t.bos_token,this.bos_token_id=this.tokens_to_ids.get(this.bos_token),this.eos_token=t.eos_token,this.eos_token_id=this.tokens_to_ids.get(this.eos_token),this.pad_token=t.pad_token,this.pad_token_id=this.tokens_to_ids.get(this.pad_token),this.unk_token=t.unk_token,this.unk_token_id=this.tokens_to_ids.get(this.unk_token),this.vocab=Array(this.tokens_to_ids.size);for(let[e,t]of this.tokens_to_ids)this.vocab[t]=e}encode(e){return e}};function st(e,t){switch(e.type){case`WordPiece`:return new Xe(e);case`Unigram`:return new nt(e,t.eos_token);case`BPE`:return new at(e);default:if(e.vocab)return Array.isArray(e.vocab)?new nt(e,t.eos_token):Object.hasOwn(e,`continuing_subword_prefix`)&&Object.hasOwn(e,`unk_token`)?Object.hasOwn(e,`merges`)?new at(e):new Xe(e):new ot(e,{target_lang:t.target_lang,bos_token:t.bos_token,eos_token:t.eos_token,pad_token:t.pad_token,unk_token:t.unk_token});throw Error(`Unknown TokenizerModel type: ${e?.type}`)}}var ct=st,lt=class extends V{constructor(e){super(),this.config=e}_call(e,...t){return this.post_process(e,...t)}},ut=class extends lt{post_process(e,t=null,n=!0){let r=t===null?this.config.single:this.config.pair,i=[],a=[];for(let o of r)`SpecialToken`in o?n&&(i.push(o.SpecialToken.id),a.push(o.SpecialToken.type_id)):`Sequence`in o&&(o.Sequence.id===`A`?(i=z(i,e),a=z(a,Array(e.length).fill(o.Sequence.type_id))):o.Sequence.id===`B`&&(i=z(i,t),a=z(a,Array(t.length).fill(o.Sequence.type_id))));return{tokens:i,token_type_ids:a}}},dt=class extends lt{post_process(e,t=null){return{tokens:e,tokens_pair:t}}},ft=class extends lt{constructor(e){super(e),this.sep=e.sep,this.cls=e.cls}post_process(e,t=null,n=!0){n&&(e=z([this.cls[0]],e,[this.sep[0]]));let r=Array(e.length).fill(0);if(t){let i=[],a=n?[this.sep[0]]:[];e=z(e,i,t,a),r=z(r,Array(t.length+i.length+a.length).fill(1))}return{tokens:e,token_type_ids:r}}},pt=class extends lt{constructor(e){super(e),this.sep=e.sep,this.cls=e.cls}post_process(e,t,n=!0){n&&(e=z([this.cls[0]],e,[this.sep[0]]));let r=Array(e.length).fill(0);if(t){let i=n?[this.sep[0]]:[],a=n?[this.sep[0]]:[];e=z(e,i,t,a),r=z(r,Array(t.length+i.length+a.length).fill(1))}return{tokens:e,token_type_ids:r}}},mt=class extends lt{constructor(e){super(e),this.processors=(e.processors??[]).map(e=>gt(e))}post_process(e,t=null,n=!0){let r={tokens:e,tokens_pair:t};for(let e of this.processors)r=e.post_process(r.tokens,r.tokens_pair,n);return r}};function ht(e){if(e===null)return null;switch(e.type){case`TemplateProcessing`:return new ut(e);case`ByteLevel`:return new dt(e);case`BertProcessing`:return new ft(e);case`RobertaProcessing`:return new pt(e);case`Sequence`:return new mt(e);default:throw Error(`Unknown PostProcessor type: ${e.type}`)}}var gt=ht,_t=class extends V{constructor(e){super(),this.config=e,this.added_tokens=[],this.end_of_word_suffix=null,this.trim_offsets=`trim_offsets`in e?e.trim_offsets:!1}_call(e){return this.decode(e)}decode(e){return this.decode_chain(e).join(``)}},vt=class extends _t{constructor(e){super(e),this.byte_decoder=ie,this.text_decoder=new TextDecoder(`utf-8`,{fatal:!1,ignoreBOM:!0}),this.end_of_word_suffix=null}convert_tokens_to_string(e){let t=e.join(``),n=new Uint8Array([...t].map(e=>this.byte_decoder[e]));return this.text_decoder.decode(n)}decode_chain(e){let t=[],n=[];for(let r of e)this.added_tokens.find(e=>e.content===r)===void 0?n.push(r):(n.length>0&&(t.push(this.convert_tokens_to_string(n)),n=[]),t.push(r));return n.length>0&&t.push(this.convert_tokens_to_string(n)),t}},yt=class extends _t{constructor(e){super(e),this.cleanup=e.cleanup}decode_chain(e){return e.map((e,t)=>{if(t!==0){let t=this.config.prefix;e=t&&e.startsWith(t)?e.replace(t,``):` `+e}return this.cleanup&&(e=ce(e)),e})}},bt=class extends _t{constructor(e){super(e),this.replacement=e.replacement??`▁`}decode_chain(e){let t=[];for(let n=0;n<e.length;++n){let r=e[n].replaceAll(this.replacement,` `);n==0&&r.startsWith(` `)&&(r=r.substring(1)),t.push(r)}return t}},xt=class extends _t{constructor(e){super(e),this.suffix=e.suffix??``}decode_chain(e){return e.map((t,n)=>t.replaceAll(this.suffix,n===e.length-1?``:` `))}},St=class extends _t{constructor(e){super(e),this.pad_token=e.pad_token??``,this.word_delimiter_token=e.word_delimiter_token??``,this.cleanup=e.cleanup}convert_tokens_to_string(e){if(e.length===0)return``;let t=[e[0]];for(let n=1;n<e.length;++n)e[n]!==t.at(-1)&&t.push(e[n]);let n=t.filter(e=>e!==this.pad_token).join(``);return this.cleanup&&(n=ce(n).replaceAll(this.word_delimiter_token,` `).trim()),n}decode_chain(e){return[this.convert_tokens_to_string(e)]}},Ct=class extends _t{constructor(e){super(e),this.decoders=(e.decoders??[]).map(e=>kt(e))}decode_chain(e){return this.decoders.reduce((e,t)=>t.decode_chain(e),e)}},wt=class extends _t{decode_chain(e){let t=le(this.config.pattern),n=this.config.content??``;return t===null?e:e.map(e=>e.replaceAll(t,n))}},Tt=class extends _t{decode_chain(e){return[e.join(``)]}},Et=class extends _t{constructor(e){super(e),this.content=e.content??``,this.start=e.start??0,this.stop=e.stop??0}decode_chain(e){return e.map(e=>{let t=0;for(let n=0;n<this.start&&e[n]===this.content;++n)t=n+1;let n=e.length;for(let t=0;t<this.stop;++t){let r=e.length-t-1;if(e[r]===this.content){n=r;continue}else break}return e.slice(t,n)})}},Dt=class extends _t{constructor(e){super(e),this.text_decoder=new TextDecoder}decode_chain(e){let t=[],n=[];for(let r of e){let e=null;if(r.length===6&&r.startsWith(`<0x`)&&r.endsWith(`>`)){let t=parseInt(r.slice(3,5),16);isNaN(t)||(e=t)}if(e!==null)n.push(e);else{if(n.length>0){let e=this.text_decoder.decode(Uint8Array.from(n));t.push(e),n=[]}t.push(r)}}if(n.length>0){let e=this.text_decoder.decode(Uint8Array.from(n));t.push(e),n=[]}return t}};function Ot(e){if(e===null)return null;switch(e.type){case`ByteLevel`:return new vt(e);case`WordPiece`:return new yt(e);case`Metaspace`:return new bt(e);case`BPEDecoder`:return new xt(e);case`CTC`:return new St(e);case`Sequence`:return new Ct(e);case`Replace`:return new wt(e);case`Fuse`:return new Tt(e);case`Strip`:return new Et(e);case`ByteFallback`:return new Dt(e);default:throw Error(`Unknown Decoder type: ${e.type}`)}}var kt=Ot,At=class{constructor(e,t){let n=B(e,`Tokenizer`,[`model`,`decoder`,`post_processor`,`pre_tokenizer`,`normalizer`]);if(n)throw Error(n);let r=B(t,`Config`);if(r)throw Error(r);this.tokenizer=e,this.config=t,this.normalizer=Pe(this.tokenizer.normalizer),this.pre_tokenizer=Je(this.tokenizer.pre_tokenizer),this.model=ct(this.tokenizer.model,this.config),this.post_processor=gt(this.tokenizer.post_processor),this.decoder=kt(this.tokenizer.decoder),this.special_tokens=[],this.all_special_ids=[],this.added_tokens=[];let i=[],a=[];this.added_tokens_map=new Map;for(let e of this.tokenizer.added_tokens){let t=new ne(e);if(this.added_tokens.push(t),this.model.tokens_to_ids.set(t.content,t.id),this.model.vocab[t.id]=t.content,t.special&&(this.special_tokens.push(t.content),this.all_special_ids.push(t.id)),this.added_tokens_map.set(t.content,t),t.normalized&&this.normalizer!==null){let e=this.normalizer(t.content);a.push(e),this.added_tokens_map.set(e,t)}else i.push(t.content)}(this.config.additional_special_tokens??[]).forEach(e=>{this.special_tokens.includes(e)||this.special_tokens.push(e)}),this.decoder&&(this.decoder.added_tokens=this.added_tokens,this.decoder.end_of_word_suffix=this.model.end_of_word_suffix),this.splitter_unnormalized=new R(i),this.splitter_normalized=new R(a),this.remove_space=this.config.remove_space,this.clean_up_tokenization_spaces=this.config.clean_up_tokenization_spaces??!0,this.do_lowercase_and_remove_accent=this.config.do_lowercase_and_remove_accent??!1}encode(e,{text_pair:t=null,add_special_tokens:n=!0,return_token_type_ids:r=null}={}){let{tokens:i,token_type_ids:a}=this.tokenize_helper(e,{text_pair:t,add_special_tokens:n}),o=i.map(e=>this.added_tokens_map.get(e)?.id??this.model.tokens_to_ids.get(e)??this.model.unk_token_id),s={ids:o,tokens:i,attention_mask:Array(o.length).fill(1)};return r&&a&&(s.token_type_ids=a),s}decode(e,t={}){if(!Array.isArray(e)||e.length===0||!pe(e[0]))throw Error(`token_ids must be a non-empty array of integers.`);let n=e.map(e=>this.model.vocab[Number(e)]??this.model.unk_token);t.skip_special_tokens&&(n=n.filter(e=>!this.special_tokens.includes(e)));let r=this.decoder?this.decoder(n):n.join(` `);return this.decoder&&this.decoder.end_of_word_suffix&&(r=r.replaceAll(this.decoder.end_of_word_suffix,` `),t.skip_special_tokens&&(r=r.trim())),(t.clean_up_tokenization_spaces??this.clean_up_tokenization_spaces)&&(r=ce(r)),r}tokenize(e,{text_pair:t=null,add_special_tokens:n=!1}={}){return this.tokenize_helper(e,{text_pair:t,add_special_tokens:n}).tokens}encode_text(e){if(e===null)return null;let t=this.splitter_unnormalized.split(e);return t.forEach((e,n)=>{let r=this.added_tokens_map.get(e);r&&(r.lstrip&&n>0&&(t[n-1]=t[n-1].trimEnd()),r.rstrip&&n<t.length-1&&(t[n+1]=t[n+1].trimStart()))}),t.flatMap((e,t)=>{if(e.length===0)return[];if(this.added_tokens_map.has(e))return[e];if(this.remove_space===!0&&(e=e.trim().split(/\s+/).join(` `)),this.do_lowercase_and_remove_accent&&(e=he(e)),this.normalizer!==null&&(e=this.normalizer(e)),e.length===0)return[];let n=this.splitter_normalized.split(e);return n.forEach((e,t)=>{let r=this.added_tokens_map.get(e);r&&(r.lstrip&&t>0&&(n[t-1]=n[t-1].trimEnd()),r.rstrip&&t<n.length-1&&(n[t+1]=n[t+1].trimStart()))}),n.flatMap(e=>{if(e.length===0)return[];if(this.added_tokens_map.has(e))return[e];let n=this.pre_tokenizer===null?[e]:this.pre_tokenizer(e,{section_index:t});return this.model(n)})})}tokenize_helper(e,{text_pair:t=null,add_special_tokens:n=!0}){let r=this.encode_text(e),i=this.encode_text(t||null);return this.post_processor?this.post_processor(r,i,n):{tokens:z(r??[],i??[])}}token_to_id(e){return this.model.tokens_to_ids.get(e)}id_to_token(e){return this.model.vocab[e]}get_added_tokens_decoder(){let e=new Map;for(let t of this.added_tokens)e.set(t.id,t);return e}get_vocab(e=!0){let t=new Map;for(let n=0;n<this.model.vocab.length;++n){let r=this.model.vocab[n];(e||!this.added_tokens_map.has(r))&&t.set(r,n)}return t}};function jt(e){let t=e.byteLength/2,n=new Float32Array(t),r=new Uint32Array(n.buffer);if(e.byteOffset%2==0){let n=new Uint16Array(e.buffer,e.byteOffset,t);for(let e=0;e<t;++e)r[e]=n[e]<<16}else for(let n=0;n<t;++n){let t=e[n*2];r[n]=(e[n*2+1]<<8|t)<<16}return n}function Mt(e){let t=e.byteLength/2,n=new Uint16Array(t);return Nt(e,n),n}function Nt(e,t,n=0,r=1){let i=e.byteLength/2,a=zt();if(e.byteOffset%2==0){let o=new Uint16Array(e.buffer,e.byteOffset,i);for(let e=0,s=n;e<i;++e,s+=r)t[s]=a[o[e]]}else for(let o=0,s=n;o<i;++o,s+=r){let n=e[o*2];t[s]=a[e[o*2+1]<<8|n]}return t}function Pt(e,t,n){let r=t*n;if(e.byteLength!==r*2)throw Error(`BF16 byte length ${e.byteLength} does not match ${t}x${n}`);let i=new Uint16Array(r),a=zt();if(e.byteOffset%2==0){let o=new Uint16Array(e.buffer,e.byteOffset,r);for(let e=0;e<n;++e){let r=e*t;for(let s=0;s<t;++s)i[r+s]=a[o[s*n+e]]}}else for(let r=0;r<n;++r){let o=r*t;for(let s=0;s<t;++s){let t=(s*n+r)*2;i[o+s]=a[e[t+1]<<8|e[t]]}}return i}function Ft(e){let t=e&32768?-1:1,n=e>>>10&31,r=e&1023;return n===31?r===0?t*(1/0):NaN:n===0?t*2**-14*(r/1024):t*2**(n-15)*(1+r/1024)}function It(e){if(Number.isNaN(e))return 32256;if(e===1/0)return 31744;if(e===-1/0)return 64512;let t=e<0||Object.is(e,-0)?32768:0,n=Math.abs(e);if(n===0)return t;if(n>=65504)return t|31743;if(n<5.960464477539063e-8)return t;if(n<6103515625e-14)return t|Math.round(n/5.960464477539063e-8);let r=Math.floor(Math.log2(n)),i=Math.round((n/2**r-1)*1024);return i===1024?t|r+16<<10:t|r+15<<10|i}function Lt(e){let t=e&32768,n=e>>>7&255,r=e&127;if(n===255)return r===0?t|31744:32256;if(n===0)return t;let i=n-112;if(i>=31)return t|31743;if(i>0)return t|i<<10|r<<3;if(n<103)return t;let a=128|r,o=110-n,s;return s=o<=0?a<<-o:o>=16?0:(a>>>o)+ +((a&(1<<o)-1)*2>=1<<o),t|Math.min(s,1023)}var Rt=null;function zt(){if(Rt)return Rt;let e=new Uint16Array(65536);for(let t=0;t<e.length;++t)e[t]=Lt(t);return Rt=e,e}function Bt(e,t=new Set){if(!(typeof e!=`object`||!e)&&!t.has(e)&&(t.add(e),!(ArrayBuffer.isView(e)||e instanceof ArrayBuffer))){if(Wt(e)){e.destroy?.();return}if(Gt(e)){e.destroy();return}if(e instanceof Map){for(let n of e.values())Bt(n,t);e.clear();return}if(e instanceof Set){for(let n of e.values())Bt(n,t);e.clear();return}for(let n of Object.keys(e))Bt(e[n],t)}}function Vt(){let e=[],t=new Set,n=!1;return{track(t){if(n)throw Error(`Cannot track GPU resources after scope.destroy()`);return typeof t==`object`&&t&&e.push(t),t},keep(e){return Ut(e,t),e},destroy(){if(n)return;n=!0;let r=new Set(t);for(let t=e.length-1;t>=0;--t)Bt(e[t],r);e.length=0,t.clear()},get size(){return e.length}}}function Ht(e,t){if(!t)return e;let n=new Set([`empty`,`tensorFromTypedArray`,`createUniformU32`]);return new Proxy(e,{get(e,r,i){let a=Reflect.get(e,r,i);return typeof a==`function`?n.has(r)?(...n)=>t.track(a.apply(e,n)):a.bind(e):a}})}function Ut(e,t){if(!(typeof e!=`object`||!e)&&!t.has(e)&&(t.add(e),!(ArrayBuffer.isView(e)||e instanceof ArrayBuffer)&&!(Wt(e)||Gt(e)))){if(e instanceof Map){for(let n of e.values())Ut(n,t);return}if(e instanceof Set){for(let n of e.values())Ut(n,t);return}for(let n of Object.keys(e))Ut(e[n],t)}}function Wt(e){return Array.isArray(e.shape)&&typeof e.dtype==`string`&&e.buffer&&typeof e.buffer.destroy==`function`}function Gt(e){return typeof e.destroy==`function`&&typeof e.mapAsync==`function`&&typeof e.getMappedRange==`function`}function Kt(e){return Math.floor(32/e)}function qt(e,t){if(e%t!==0)throw Error(`inFeatures (${e}) must be divisible by groupSize (${t})`);return Math.floor(e/t)}function Jt({scalesBytes:e,biasesBytes:t,outFeatures:n,inFeatures:r,groupSize:i,dtype:a=`f32`}){let o=qt(r,i),s=a===`f16`?Mt(e):jt(e),c=a===`f16`?Mt(t):jt(t);if(s.length!==n*o||c.length!==n*o)throw Error(`scale/bias length mismatch (expected ${n*o})`);let l=a===`f16`?new Uint16Array(n*o*2):new Float32Array(n*o*2);for(let e=0;e<n;++e)for(let t=0;t<o;++t){let r=(t*n+e)*2;l[r]=s[e*o+t],l[r+1]=c[e*o+t]}if(a===`f32`||a===`f16`)return l;throw Error(`Unsupported scaleBias dtype: ${a}`)}function Yt({scalesBytes:e,biasesBytes:t,outFeatures:n,inFeatures:r,groupSize:i,dtype:a=`f32`}){let o=qt(r,i),s=a===`f16`?new Uint16Array(n*o*2):new Float32Array(n*o*2);return Xt({scalesBytes:e,biasesBytes:t,out:s,outFeatures:n,inFeatures:r,groupSize:i,dtype:a}),s}function Xt({scalesBytes:e,biasesBytes:t,out:n,outFeatures:r,inFeatures:i,groupSize:a,dtype:o=`f32`,dstElementOffset:s=0}){let c=qt(i,a),l=r*c;if(o===`f16`){if(e.byteLength!==l*2||t.byteLength!==l*2)throw Error(`scale/bias length mismatch (expected ${l})`);return Nt(e,n,s,2),Nt(t,n,s+1,2),n}let u=jt(e),d=jt(t);if(u.length!==l||d.length!==l)throw Error(`scale/bias length mismatch (expected ${l})`);for(let e=0;e<r*c;++e){let t=s+e*2;n[t]=u[e],n[t+1]=d[e]}if(o===`f32`)return n;throw Error(`Unsupported scaleBias dtype: ${o}`)}function Zt(){let e=new Map,t=new Set;function n(n,r){if(e.has(n))throw Error(`Duplicate handler for tensor: ${n}`);t.add(n),e.set(n,{async receive(e){t.delete(n),await r(e)}})}function r(n,r){let i={},a=n.length,o=null,s=null,c=null;for(let o of n){if(e.has(o))throw Error(`Duplicate handler for tensor: ${o}`);t.add(o),e.set(o,{async receive(e){if(t.delete(o),i[o]=e,--a===0)try{await r(i),s&&s()}catch(e){if(c)c(e);else throw e}finally{for(let e of n)delete i[e]}}})}return o=new Promise((e,t)=>{s=e,c=t}),o}async function i({bytes:t,tensors:n}){let r=[];for(let i of n){let n=e.get(i.name);if(!n)continue;let a=t.subarray(i.offset,i.offset+i.length);r.push(n.receive(a))}r.length&&await Promise.all(r)}function a(){if(t.size>0){let e=[...t].slice(0,5).join(`, `);throw Error(`Stream plan incomplete \u2014 ${t.size} tensor(s) never arrived (first: ${e})`)}}function o(){return[...e.keys()]}return{tensor:n,group:r,onChunk:i,assertComplete:a,names:o}}function Qt(e,t,n){let r=new ArrayBuffer(16),i=new Uint32Array(r),a=new Float32Array(r);for(let e=0;e<4;++e){let n=t[e];if(n==null){i[e]=0;continue}if(`u32`in n)i[e]=n.u32>>>0;else if(`f32`in n)a[e]=n.f32;else throw Error(`uniform item ${e} must be {u32} or {f32}`)}return e.createUniformU32(new Uint32Array(r),n)}function $t(e){return e===`float16`?`f16`:`f32`}function en(...e){return e.includes(`float16`)?`enable f16;
`:``}function tn(e,t){return t===`float16`?`f32(${e})`:e}function nn(e,t){return t===`float16`?`f16(${e})`:e}function rn(e,t){return t===`float16`?`vec4<f32>(${e})`:e}function an({dim:e,eps:t,withWeight:n=!0,inputDtype:r=`float32`,weightDtype:i=`float32`,outputDtype:a=`float32`}){let o=$t(r),s=$t(i),c=$t(a);return`${en(r,i,a)}struct Params { rows: u32, rowStride: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       x: array<${o}>;
${n?`@group(0) @binding(1) var<storage, read>       w: array<${s}>;
`:``}@group(0) @binding(${n?2:1}) var<storage, read_write> y: array<${c}>;
@group(0) @binding(${n?3:2}) var<uniform>             params: Params;

const DIM: u32 = ${e}u;
const EPS: f32 = ${t};
const WG: u32 = 64u;

var<workgroup> partial: array<f32, WG>;

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let rowStride = select(params.rowStride, params.rows, params.rowStride == 0u);
  let row = wg.x + wg.y * rowStride;
  if (row >= params.rows) { return; }
  let tid = lid.x;
  let base = row * DIM;

  // Compute sum of squares.
  var acc: f32 = 0.0;
  var i: u32 = tid;
  loop {
    if (i >= DIM) { break; }
    let v = ${tn(`x[base + i]`,r)};
    acc = acc + v * v;
    i = i + WG;
  }
  partial[tid] = acc;
  workgroupBarrier();
  var stride: u32 = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) { partial[tid] = partial[tid] + partial[tid + stride]; }
    stride = stride / 2u;
    workgroupBarrier();
  }
  let scale = inverseSqrt(partial[0] / f32(DIM) + EPS);

  // Apply normalization (+ optional weight).
  var j: u32 = tid;
  loop {
    if (j >= DIM) { break; }
    let xv = ${tn(`x[base + j]`,r)};
    ${n?`let wv = ${tn(`w[j]`,i)};
    y[base + j] = ${nn(`xv * scale * wv`,a)};`:`y[base + j] = ${nn(`xv * scale`,a)};`}
    j = j + WG;
  }
}
`}function on({headDim:e,activationDtype:t=`float32`}){let n=e/2,r=Math.min(64,n),i=$t(t);return`${en(t)}struct Params { seq: u32, heads: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read_write> q: array<${i}>;
@group(0) @binding(1) var<storage, read>       cosTbl: array<f32>;
@group(0) @binding(2) var<storage, read>       sinTbl: array<f32>;
@group(0) @binding(3) var<uniform>             params: Params;

const HEAD_DIM: u32 = ${e}u;
const HALF_DIM: u32 = ${n}u;
const WG: u32 = ${r}u;

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let t = wg.x;
  let h = wg.y;
  if (t >= params.seq || h >= params.heads) { return; }
  let tid = lid.x;
  let qBase = (t * params.heads + h) * HEAD_DIM;
  let csBase = t * HALF_DIM;

  var k: u32 = tid;
  loop {
    if (k >= HALF_DIM) { break; }
    let c = cosTbl[csBase + k];
    let s = sinTbl[csBase + k];
    let x0 = ${tn(`q[qBase + k]`,t)};
    let x1 = ${tn(`q[qBase + k + HALF_DIM]`,t)};
    q[qBase + k] = ${nn(`x0 * c - x1 * s`,t)};
    q[qBase + k + HALF_DIM] = ${nn(`x1 * c + x0 * s`,t)};
    k = k + WG;
  }
}
`}function sn({dtype:e=`float32`}={}){let t=$t(e);return`${en(e)}struct Params { count: u32, wgY: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read_write> x: array<${t}>;
@group(0) @binding(1) var<uniform>             params: Params;
const WG: u32 = 64u;
@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let i = wg_idx * WG + lid.x;
  if (i >= params.count) { return; }
  let v = ${tn(`x[i]`,e)};
  x[i] = ${nn(`v / (1.0 + exp(-v))`,e)};
}
`}function cn(e,t=64){let n=Math.ceil(e/t),r=Math.min(n,1024);return{wgX:Math.ceil(n/r),wgY:r}}function ln({mlpInner:e,inputDtype:t=`float32`,outputDtype:n=`float32`}){if(t===`float16`&&n===`float16`&&e%4==0)return`enable f16;
struct Params { rows: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       x: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read_write> y: array<vec4<f16>>;
@group(0) @binding(2) var<uniform>             params: Params;
const MLP_V4: u32 = ${e/4}u;
const WG: u32 = 64u;
@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let r = wg.x;
  if (r >= params.rows) { return; }
  let i0 = wg.y * WG + lid.x;
  if (i0 >= MLP_V4) { return; }
  let row_base = r * 2u * MLP_V4;
  let x1 = vec4<f32>(x[row_base + i0]);
  let x2 = vec4<f32>(x[row_base + MLP_V4 + i0]);
  y[r * MLP_V4 + i0] = vec4<f16>((x1 / (vec4<f32>(1.0) + exp(-x1))) * x2);
}
`;let r=$t(t),i=$t(n);return`${en(t,n)}struct Params { rows: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       x: array<${r}>;
@group(0) @binding(1) var<storage, read_write> y: array<${i}>;
@group(0) @binding(2) var<uniform>             params: Params;
const MLP: u32 = ${e}u;
const WG: u32 = 64u;
@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let r = wg.x;
  if (r >= params.rows) { return; }
  let i0 = wg.y * WG + lid.x;
  if (i0 >= MLP) { return; }
  let x1 = ${tn(`x[r * 2u * MLP + i0]`,t)};
  let x2 = ${tn(`x[r * 2u * MLP + MLP + i0]`,t)};
  y[r * MLP + i0] = ${nn(`(x1 / (1.0 + exp(-x1))) * x2`,n)};
}
`}function un({xDtype:e=`float32`,yDtype:t=`float32`}={}){let n=$t(e),r=$t(t);return`${en(e,t)}struct Params { count: u32, alpha: f32, wgY: u32, _pad0: u32 };
@group(0) @binding(0) var<storage, read_write> x: array<${n}>;
@group(0) @binding(1) var<storage, read>       y: array<${r}>;
@group(0) @binding(2) var<uniform>             params: Params;
const WG: u32 = 64u;
@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let i = wg_idx * WG + lid.x;
  if (i >= params.count) { return; }
  x[i] = ${nn(`${tn(`x[i]`,e)} + params.alpha * ${tn(`y[i]`,t)}`,e)};
}
`}function dn({xDtype:e=`float32`,factorDtype:t=`float32`}={}){let n=$t(e),r=$t(t);return`${en(e,t)}struct Params { count: u32, period: u32, wgY: u32, _pad0: u32 };
@group(0) @binding(0) var<storage, read_write> x: array<${n}>;
@group(0) @binding(1) var<storage, read>       factor: array<${r}>;
@group(0) @binding(2) var<uniform>             params: Params;
const WG: u32 = 64u;
@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let i = wg_idx * WG + lid.x;
  if (i >= params.count) { return; }
  let pIdx = select(i, i % params.period, params.period > 0u);
  x[i] = ${nn(`${tn(`x[i]`,e)} * ${tn(`factor[pIdx]`,t)}`,e)};
}
`}function fn({headDim:e,inputDtype:t=`float32`,outputDtype:n=`float32`}){let r=$t(t),i=$t(n);return`${en(t,n)}struct Params { seq: u32, qHeads: u32, kvHeads: u32, causal: u32 };
@group(0) @binding(0) var<storage, read>       q: array<${r}>;
@group(0) @binding(1) var<storage, read>       k: array<${r}>;
@group(0) @binding(2) var<storage, read>       v: array<${r}>;
@group(0) @binding(3) var<storage, read_write> out: array<${i}>;
@group(0) @binding(4) var<uniform>             params: Params;

const HEAD_DIM: u32 = ${e}u;
const WG: u32 = 64u;
const SCALE: f32 = ${(1/Math.sqrt(e)).toFixed(8)};

var<workgroup> partial: array<f32, WG>;
var<workgroup> reduced_scalar: f32;
var<workgroup> running_max: f32;
var<workgroup> running_denom: f32;
var<workgroup> running_out: array<f32, ${e}>;

fn reduce_sum(tid: u32) -> f32 {
  workgroupBarrier();
  var stride: u32 = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) { partial[tid] = partial[tid] + partial[tid + stride]; }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return partial[0];
}

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let qi = wg.x;
  let h  = wg.y;
  if (qi >= params.seq || h >= params.qHeads) { return; }
  let tid = lid.x;
  let groupSize = params.qHeads / params.kvHeads;
  let hKv = h / groupSize;

  let qBase = (qi * params.qHeads + h) * HEAD_DIM;

  if (tid == 0u) {
    running_max = -3.4e38;
    running_denom = 0.0;
  }
  for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) { running_out[d] = 0.0; }
  workgroupBarrier();

  let maxKj = select(params.seq, qi + 1u, params.causal != 0u);

  for (var kj: u32 = 0u; kj < maxKj; kj = kj + 1u) {
    let kBase = (kj * params.kvHeads + hKv) * HEAD_DIM;
    // dot(Q[qi,h], K[kj,hKv])
    var acc: f32 = 0.0;
    for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
      acc = acc + ${tn(`q[qBase + d]`,t)} * ${tn(`k[kBase + d]`,t)};
    }
    partial[tid] = acc;
    let dot = reduce_sum(tid) * SCALE;

    // Online softmax update.
    if (tid == 0u) {
      let mNew = max(running_max, dot);
      let exp_old = exp(running_max - mNew);
      let exp_new = exp(dot - mNew);
      reduced_scalar = exp_old; // reuse: factor to scale previous outputs
      running_max = mNew;
      running_denom = running_denom * exp_old + exp_new;
    }
    workgroupBarrier();
    let scaleOld = reduced_scalar;
    let probNew = exp(dot - running_max);
    // Update running_out: scale prior accum + add probNew * V[kj]
    let vBase = (kj * params.kvHeads + hKv) * HEAD_DIM;
    for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
      running_out[d] = running_out[d] * scaleOld + probNew * ${tn(`v[vBase + d]`,t)};
    }
    workgroupBarrier();
  }

  // Write final.
  let outBase = (qi * params.qHeads + h) * HEAD_DIM;
  let inv = 1.0 / running_denom;
  for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
    out[outBase + d] = ${nn(`running_out[d] * inv`,n)};
  }
}
`}function pn({headDim:e,kTile:t=64,inputDtype:n=`float32`,outputDtype:r=`float32`,useSubgroups:i=!1}){if(e%4!=0)throw Error(`headDim must be divisible by 4`);let a=t;if(a>256)throw Error(`flash attn kTile=${t} exceeds maxComputeInvocationsPerWorkgroup`);let o=e/4,s=$t(n),c=$t(r),l=i?`, sg_size: u32`:``,u=i?`, sg_size`:``,d=i?`enable subgroups;
`:``,f=i?`  if (sg_size == WG) {
    return subgroupMax(value);
  }
`:``,p=i?`  if (sg_size == WG) {
    return subgroupAdd(value);
  }
`:``;return`${en(n,r)}${d}struct Params { seq: u32, qHeads: u32, kvHeads: u32, _pad0: u32 };
@group(0) @binding(0) var<storage, read>       q: array<vec4<${s}>>;
@group(0) @binding(1) var<storage, read>       k: array<vec4<${s}>>;
@group(0) @binding(2) var<storage, read>       v: array<vec4<${s}>>;
@group(0) @binding(3) var<storage, read_write> out: array<${c}>;
@group(0) @binding(4) var<uniform>             params: Params;

const HEAD_DIM:    u32 = ${e}u;
const HEAD_DIM_V4: u32 = ${o}u;
const K_TILE:      u32 = ${t}u;
const WG:          u32 = ${a}u;
const SCALE:       f32 = ${(1/Math.sqrt(e)).toFixed(8)};
const NEG_INF:     f32 = -3.4e38;

var<workgroup> q_shared:     array<vec4<f32>, HEAD_DIM_V4>;
var<workgroup> probs:        array<f32, K_TILE>;
var<workgroup> running_out:  array<f32, HEAD_DIM>;
var<workgroup> running_max:  f32;
var<workgroup> running_denom: f32;
var<workgroup> scale_old:    f32;
var<workgroup> reduce_buf:   array<f32, K_TILE>;

fn reduce_max(value: f32, tid: u32${l}) -> f32 {
${f}  reduce_buf[tid] = value;
  workgroupBarrier();
  var stride: u32 = K_TILE / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      reduce_buf[tid] = max(reduce_buf[tid], reduce_buf[tid + stride]);
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return reduce_buf[0];
}

fn reduce_sum(value: f32, tid: u32${l}) -> f32 {
${p}  reduce_buf[tid] = value;
  workgroupBarrier();
  var stride: u32 = K_TILE / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      reduce_buf[tid] = reduce_buf[tid] + reduce_buf[tid + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return reduce_buf[0];
}

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>${i?`, @builtin(subgroup_size) sg_size: u32`:``}) {
  let qi = wg.x;
  let h  = wg.y;
  if (qi >= params.seq || h >= params.qHeads) { return; }
  let tid = lid.x;
  let kvGroupSize = params.qHeads / params.kvHeads;
  let hKv = h / kvGroupSize;

  // Load Q row (as vec4) into wgmem (cooperative).
  let qBaseV4 = (qi * params.qHeads + h) * HEAD_DIM_V4;
  for (var d: u32 = tid; d < HEAD_DIM_V4; d = d + WG) {
    q_shared[d] = ${rn(`q[qBaseV4 + d]`,n)};
  }
  // Init accumulators.
  for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
    running_out[d] = 0.0;
  }
  if (tid == 0u) {
    running_max = NEG_INF;
    running_denom = 0.0;
  }
  workgroupBarrier();

  let seqLocal = params.seq;
  var kj_base: u32 = 0u;
  loop {
    if (kj_base >= seqLocal) { break; }
    let kj = kj_base + tid;
    var dot_val: f32 = NEG_INF;
    if (kj < seqLocal) {
      let kBaseV4 = (kj * params.kvHeads + hKv) * HEAD_DIM_V4;
      var acc: f32 = 0.0;
      for (var d: u32 = 0u; d < HEAD_DIM_V4; d = d + 1u) {
        acc = acc + dot(q_shared[d], ${rn(`k[kBaseV4 + d]`,n)});
      }
      dot_val = acc * SCALE;
    }
    let tile_max = reduce_max(dot_val, tid${u});
    if (tid == 0u) {
      let new_max = max(running_max, tile_max);
      scale_old = exp(running_max - new_max);
      running_max = new_max;
    }
    workgroupBarrier();

    var prob_val: f32 = 0.0;
    if (kj < seqLocal) {
      prob_val = exp(dot_val - running_max);
    }
    probs[tid] = prob_val;

    let tile_sum = reduce_sum(prob_val, tid${u});
    if (tid == 0u) {
      running_denom = running_denom * scale_old + tile_sum;
    }
    workgroupBarrier();

    // Update running_out using vec4 V loads. Each thread handles HEAD_DIM_V4 / WG groups of 4 dims.
    let tile_count = min(K_TILE, seqLocal - kj_base);
    let scale_old_v = scale_old;
    for (var d4: u32 = tid; d4 < HEAD_DIM_V4; d4 = d4 + WG) {
      var v_sum: vec4<f32> = vec4<f32>(0.0, 0.0, 0.0, 0.0);
      for (var i: u32 = 0u; i < tile_count; i = i + 1u) {
        let vBaseV4 = ((kj_base + i) * params.kvHeads + hKv) * HEAD_DIM_V4;
        v_sum = v_sum + probs[i] * ${rn(`v[vBaseV4 + d4]`,n)};
      }
      let dBase = d4 * 4u;
      running_out[dBase + 0u] = running_out[dBase + 0u] * scale_old_v + v_sum.x;
      running_out[dBase + 1u] = running_out[dBase + 1u] * scale_old_v + v_sum.y;
      running_out[dBase + 2u] = running_out[dBase + 2u] * scale_old_v + v_sum.z;
      running_out[dBase + 3u] = running_out[dBase + 3u] * scale_old_v + v_sum.w;
    }
    workgroupBarrier();

    kj_base = kj_base + K_TILE;
  }

  let outBase = (qi * params.qHeads + h) * HEAD_DIM;
  let inv = 1.0 / running_denom;
  for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
    out[outBase + d] = ${nn(`running_out[d] * inv`,r)};
  }
}
`}function mn({headDim:e,kTile:t=32,inputDtype:n=`float32`,outputDtype:r=`float32`,useSubgroups:i=!1,useHalfQk:a=!1}){if(e%4!=0)throw Error(`headDim must be divisible by 4`);if(a&&n!==`float16`)throw Error(`useHalfQk requires float16 attention inputs`);let o=t;if(o>256)throw Error(`flash attn kTile=${t} exceeds maxComputeInvocationsPerWorkgroup`);let s=e/4,c=$t(n),l=$t(r),u=a?`f16`:`f32`,d=e=>a?e:rn(e,n),f=(e,t)=>a?`f32(dot(${e}, ${t}))`:`dot(${e}, ${t})`,p=i?`, sg_size: u32`:``,m=i?`, sg_size`:``,h=i?`enable subgroups;
`:``,g=i?`  if (sg_size == WG) {
    return subgroupMax(value);
  }
`:``,_=i?`  if (sg_size == WG) {
    return subgroupAdd(value);
  }
`:``;return`${en(n,r)}${h}struct Params { seq: u32, qHeads: u32, kvHeads: u32, _pad0: u32 };
@group(0) @binding(0) var<storage, read>       q: array<vec4<${c}>>;
@group(0) @binding(1) var<storage, read>       k: array<vec4<${c}>>;
@group(0) @binding(2) var<storage, read>       v: array<vec4<${c}>>;
@group(0) @binding(3) var<storage, read_write> out: array<${l}>;
@group(0) @binding(4) var<uniform>             params: Params;

const HEAD_DIM:    u32 = ${e}u;
const HEAD_DIM_V4: u32 = ${s}u;
const K_TILE:      u32 = ${t}u;
const WG:          u32 = ${o}u;
const SCALE:       f32 = ${(1/Math.sqrt(e)).toFixed(8)};
const NEG_INF:     f32 = -3.4e38;

var<workgroup> q0_shared:     array<vec4<${u}>, HEAD_DIM_V4>;
var<workgroup> q1_shared:     array<vec4<${u}>, HEAD_DIM_V4>;
var<workgroup> probs0:        array<f32, K_TILE>;
var<workgroup> probs1:        array<f32, K_TILE>;
var<workgroup> running_out0:  array<f32, HEAD_DIM>;
var<workgroup> running_out1:  array<f32, HEAD_DIM>;
var<workgroup> running_max0:  f32;
var<workgroup> running_max1:  f32;
var<workgroup> running_denom0: f32;
var<workgroup> running_denom1: f32;
var<workgroup> scale_old0:    f32;
var<workgroup> scale_old1:    f32;
var<workgroup> reduce_buf:    array<f32, K_TILE>;

fn reduce_max(value: f32, tid: u32${p}) -> f32 {
${g}  reduce_buf[tid] = value;
  workgroupBarrier();
  var stride: u32 = K_TILE / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      reduce_buf[tid] = max(reduce_buf[tid], reduce_buf[tid + stride]);
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return reduce_buf[0];
}

fn reduce_sum(value: f32, tid: u32${p}) -> f32 {
${_}  reduce_buf[tid] = value;
  workgroupBarrier();
  var stride: u32 = K_TILE / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      reduce_buf[tid] = reduce_buf[tid] + reduce_buf[tid + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return reduce_buf[0];
}

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>${i?`, @builtin(subgroup_size) sg_size: u32`:``}) {
  let qi0 = wg.x * 2u;
  let qi1 = qi0 + 1u;
  let h = wg.y;
  if (qi0 >= params.seq || h >= params.qHeads) { return; }
  let tid = lid.x;
  let q1_valid = qi1 < params.seq;
  let kvGroupSize = params.qHeads / params.kvHeads;
  let hKv = h / kvGroupSize;

  let q0BaseV4 = (qi0 * params.qHeads + h) * HEAD_DIM_V4;
  let q1BaseV4 = (qi1 * params.qHeads + h) * HEAD_DIM_V4;
  for (var d: u32 = tid; d < HEAD_DIM_V4; d = d + WG) {
    q0_shared[d] = ${d(`q[q0BaseV4 + d]`)};
    if (q1_valid) {
      q1_shared[d] = ${d(`q[q1BaseV4 + d]`)};
    } else {
      q1_shared[d] = vec4<${u}>(0.0);
    }
  }
  for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
    running_out0[d] = 0.0;
    running_out1[d] = 0.0;
  }
  if (tid == 0u) {
    running_max0 = NEG_INF;
    running_max1 = NEG_INF;
    running_denom0 = 0.0;
    running_denom1 = 0.0;
  }
  workgroupBarrier();

  let seqLocal = params.seq;
  var kj_base: u32 = 0u;
  loop {
    if (kj_base >= seqLocal) { break; }
    let kj = kj_base + tid;
    var dot0: f32 = NEG_INF;
    var dot1: f32 = NEG_INF;
    if (kj < seqLocal) {
      let kBaseV4 = (kj * params.kvHeads + hKv) * HEAD_DIM_V4;
      var acc0: f32 = 0.0;
      var acc1: f32 = 0.0;
      for (var d: u32 = 0u; d < HEAD_DIM_V4; d = d + 1u) {
        let kval = ${d(`k[kBaseV4 + d]`)};
        acc0 = acc0 + ${f(`q0_shared[d]`,`kval`)};
        acc1 = acc1 + ${f(`q1_shared[d]`,`kval`)};
      }
      dot0 = acc0 * SCALE;
      if (q1_valid) {
        dot1 = acc1 * SCALE;
      }
    }

    let tile_max0 = reduce_max(dot0, tid${m});
    let tile_max1 = reduce_max(dot1, tid${m});
    if (tid == 0u) {
      let new_max0 = max(running_max0, tile_max0);
      scale_old0 = exp(running_max0 - new_max0);
      running_max0 = new_max0;
      let new_max1 = max(running_max1, tile_max1);
      scale_old1 = exp(running_max1 - new_max1);
      running_max1 = new_max1;
    }
    workgroupBarrier();

    var prob0: f32 = 0.0;
    var prob1: f32 = 0.0;
    if (kj < seqLocal) {
      prob0 = exp(dot0 - running_max0);
      if (q1_valid) {
        prob1 = exp(dot1 - running_max1);
      }
    }
    probs0[tid] = prob0;
    probs1[tid] = prob1;

    let tile_sum0 = reduce_sum(prob0, tid${m});
    let tile_sum1 = reduce_sum(prob1, tid${m});
    if (tid == 0u) {
      running_denom0 = running_denom0 * scale_old0 + tile_sum0;
      running_denom1 = running_denom1 * scale_old1 + tile_sum1;
    }
    workgroupBarrier();

    let tile_count = min(K_TILE, seqLocal - kj_base);
    let scale_old_v0 = scale_old0;
    let scale_old_v1 = scale_old1;
    for (var d4: u32 = tid; d4 < HEAD_DIM_V4; d4 = d4 + WG) {
      var v_sum0: vec4<f32> = vec4<f32>(0.0);
      var v_sum1: vec4<f32> = vec4<f32>(0.0);
      for (var i: u32 = 0u; i < tile_count; i = i + 1u) {
        let vBaseV4 = ((kj_base + i) * params.kvHeads + hKv) * HEAD_DIM_V4;
        let vval = ${rn(`v[vBaseV4 + d4]`,n)};
        v_sum0 = v_sum0 + probs0[i] * vval;
        v_sum1 = v_sum1 + probs1[i] * vval;
      }
      let dBase = d4 * 4u;
      running_out0[dBase + 0u] = running_out0[dBase + 0u] * scale_old_v0 + v_sum0.x;
      running_out0[dBase + 1u] = running_out0[dBase + 1u] * scale_old_v0 + v_sum0.y;
      running_out0[dBase + 2u] = running_out0[dBase + 2u] * scale_old_v0 + v_sum0.z;
      running_out0[dBase + 3u] = running_out0[dBase + 3u] * scale_old_v0 + v_sum0.w;
      running_out1[dBase + 0u] = running_out1[dBase + 0u] * scale_old_v1 + v_sum1.x;
      running_out1[dBase + 1u] = running_out1[dBase + 1u] * scale_old_v1 + v_sum1.y;
      running_out1[dBase + 2u] = running_out1[dBase + 2u] * scale_old_v1 + v_sum1.z;
      running_out1[dBase + 3u] = running_out1[dBase + 3u] * scale_old_v1 + v_sum1.w;
    }
    workgroupBarrier();

    kj_base = kj_base + K_TILE;
  }

  let outBase0 = (qi0 * params.qHeads + h) * HEAD_DIM;
  let inv0 = 1.0 / running_denom0;
  for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
    out[outBase0 + d] = ${nn(`running_out0[d] * inv0`,r)};
  }
  if (q1_valid) {
    let outBase1 = (qi1 * params.qHeads + h) * HEAD_DIM;
    let inv1 = 1.0 / running_denom1;
    for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
      out[outBase1 + d] = ${nn(`running_out1[d] * inv1`,r)};
    }
  }
}
`}function hn({headDim:e,kTile:t=32,inputDtype:n=`float16`,outputDtype:r=`float32`,useSubgroups:i=!1,useHalfQk:a=!0}){if(e%4!=0)throw Error(`headDim must be divisible by 4`);if(n!==`float16`||!a)throw Error(`Q4 flash attention requires f16 Q/K inputs`);let o=t;if(o>256)throw Error(`flash attn kTile=${t} exceeds maxComputeInvocationsPerWorkgroup`);let s=e/4,c=$t(n),l=$t(r),u=i?`, sg_size: u32`:``,d=i?`, sg_size`:``,f=i?`enable subgroups;
`:``,p=i?`  if (sg_size == WG) {
    return subgroupMax(value);
  }
`:``,m=i?`  if (sg_size == WG) {
    return subgroupAdd(value);
  }
`:``;return`${en(n,r)}${f}struct Params { seq: u32, qHeads: u32, kvHeads: u32, _pad0: u32 };
@group(0) @binding(0) var<storage, read>       q: array<vec4<${c}>>;
@group(0) @binding(1) var<storage, read>       k: array<vec4<${c}>>;
@group(0) @binding(2) var<storage, read>       v: array<vec4<${c}>>;
@group(0) @binding(3) var<storage, read_write> out: array<${l}>;
@group(0) @binding(4) var<uniform>             params: Params;

const HEAD_DIM:    u32 = ${e}u;
const HEAD_DIM_V4: u32 = ${s}u;
const K_TILE:      u32 = ${t}u;
const WG:          u32 = ${o}u;
const SCALE:       f32 = ${(1/Math.sqrt(e)).toFixed(8)};
const NEG_INF:     f32 = -3.4e38;

var<workgroup> q0_shared:     array<vec4<f16>, HEAD_DIM_V4>;
var<workgroup> q1_shared:     array<vec4<f16>, HEAD_DIM_V4>;
var<workgroup> q2_shared:     array<vec4<f16>, HEAD_DIM_V4>;
var<workgroup> q3_shared:     array<vec4<f16>, HEAD_DIM_V4>;
var<workgroup> probs0:        array<f32, K_TILE>;
var<workgroup> probs1:        array<f32, K_TILE>;
var<workgroup> probs2:        array<f32, K_TILE>;
var<workgroup> probs3:        array<f32, K_TILE>;
var<workgroup> running_out0:  array<f32, HEAD_DIM>;
var<workgroup> running_out1:  array<f32, HEAD_DIM>;
var<workgroup> running_out2:  array<f32, HEAD_DIM>;
var<workgroup> running_out3:  array<f32, HEAD_DIM>;
var<workgroup> running_max0:  f32;
var<workgroup> running_max1:  f32;
var<workgroup> running_max2:  f32;
var<workgroup> running_max3:  f32;
var<workgroup> running_denom0: f32;
var<workgroup> running_denom1: f32;
var<workgroup> running_denom2: f32;
var<workgroup> running_denom3: f32;
var<workgroup> scale_old0:    f32;
var<workgroup> scale_old1:    f32;
var<workgroup> scale_old2:    f32;
var<workgroup> scale_old3:    f32;
var<workgroup> reduce_buf:    array<f32, K_TILE>;

fn reduce_max(value: f32, tid: u32${u}) -> f32 {
${p}  reduce_buf[tid] = value;
  workgroupBarrier();
  var stride: u32 = K_TILE / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      reduce_buf[tid] = max(reduce_buf[tid], reduce_buf[tid + stride]);
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return reduce_buf[0];
}

fn reduce_sum(value: f32, tid: u32${u}) -> f32 {
${m}  reduce_buf[tid] = value;
  workgroupBarrier();
  var stride: u32 = K_TILE / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      reduce_buf[tid] = reduce_buf[tid] + reduce_buf[tid + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return reduce_buf[0];
}

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>${i?`, @builtin(subgroup_size) sg_size: u32`:``}) {
  let qi0 = wg.x * 4u;
  let qi1 = qi0 + 1u;
  let qi2 = qi0 + 2u;
  let qi3 = qi0 + 3u;
  let h = wg.y;
  if (qi0 >= params.seq || h >= params.qHeads) { return; }
  let tid = lid.x;
  let q1_valid = qi1 < params.seq;
  let q2_valid = qi2 < params.seq;
  let q3_valid = qi3 < params.seq;
  let kvGroupSize = params.qHeads / params.kvHeads;
  let hKv = h / kvGroupSize;

  let q0BaseV4 = (qi0 * params.qHeads + h) * HEAD_DIM_V4;
  let q1BaseV4 = (qi1 * params.qHeads + h) * HEAD_DIM_V4;
  let q2BaseV4 = (qi2 * params.qHeads + h) * HEAD_DIM_V4;
  let q3BaseV4 = (qi3 * params.qHeads + h) * HEAD_DIM_V4;
  for (var d: u32 = tid; d < HEAD_DIM_V4; d = d + WG) {
    q0_shared[d] = q[q0BaseV4 + d];
    if (q1_valid) { q1_shared[d] = q[q1BaseV4 + d]; } else { q1_shared[d] = vec4<f16>(0.0); }
    if (q2_valid) { q2_shared[d] = q[q2BaseV4 + d]; } else { q2_shared[d] = vec4<f16>(0.0); }
    if (q3_valid) { q3_shared[d] = q[q3BaseV4 + d]; } else { q3_shared[d] = vec4<f16>(0.0); }
  }
  for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
    running_out0[d] = 0.0;
    running_out1[d] = 0.0;
    running_out2[d] = 0.0;
    running_out3[d] = 0.0;
  }
  if (tid == 0u) {
    running_max0 = NEG_INF;
    running_max1 = NEG_INF;
    running_max2 = NEG_INF;
    running_max3 = NEG_INF;
    running_denom0 = 0.0;
    running_denom1 = 0.0;
    running_denom2 = 0.0;
    running_denom3 = 0.0;
  }
  workgroupBarrier();

  let seqLocal = params.seq;
  var kj_base: u32 = 0u;
  loop {
    if (kj_base >= seqLocal) { break; }
    let kj = kj_base + tid;
    var dot0: f32 = NEG_INF;
    var dot1: f32 = NEG_INF;
    var dot2: f32 = NEG_INF;
    var dot3: f32 = NEG_INF;
    if (kj < seqLocal) {
      let kBaseV4 = (kj * params.kvHeads + hKv) * HEAD_DIM_V4;
      var acc0: f32 = 0.0;
      var acc1: f32 = 0.0;
      var acc2: f32 = 0.0;
      var acc3: f32 = 0.0;
      for (var d: u32 = 0u; d < HEAD_DIM_V4; d = d + 1u) {
        let kval = k[kBaseV4 + d];
        acc0 = acc0 + f32(dot(q0_shared[d], kval));
        acc1 = acc1 + f32(dot(q1_shared[d], kval));
        acc2 = acc2 + f32(dot(q2_shared[d], kval));
        acc3 = acc3 + f32(dot(q3_shared[d], kval));
      }
      dot0 = acc0 * SCALE;
      if (q1_valid) { dot1 = acc1 * SCALE; }
      if (q2_valid) { dot2 = acc2 * SCALE; }
      if (q3_valid) { dot3 = acc3 * SCALE; }
    }

    let tile_max0 = reduce_max(dot0, tid${d});
    let tile_max1 = reduce_max(dot1, tid${d});
    let tile_max2 = reduce_max(dot2, tid${d});
    let tile_max3 = reduce_max(dot3, tid${d});
    if (tid == 0u) {
      let new_max0 = max(running_max0, tile_max0);
      scale_old0 = exp(running_max0 - new_max0);
      running_max0 = new_max0;
      let new_max1 = max(running_max1, tile_max1);
      scale_old1 = exp(running_max1 - new_max1);
      running_max1 = new_max1;
      let new_max2 = max(running_max2, tile_max2);
      scale_old2 = exp(running_max2 - new_max2);
      running_max2 = new_max2;
      let new_max3 = max(running_max3, tile_max3);
      scale_old3 = exp(running_max3 - new_max3);
      running_max3 = new_max3;
    }
    workgroupBarrier();

    var prob0: f32 = 0.0;
    var prob1: f32 = 0.0;
    var prob2: f32 = 0.0;
    var prob3: f32 = 0.0;
    if (kj < seqLocal) {
      prob0 = exp(dot0 - running_max0);
      if (q1_valid) { prob1 = exp(dot1 - running_max1); }
      if (q2_valid) { prob2 = exp(dot2 - running_max2); }
      if (q3_valid) { prob3 = exp(dot3 - running_max3); }
    }
    probs0[tid] = prob0;
    probs1[tid] = prob1;
    probs2[tid] = prob2;
    probs3[tid] = prob3;

    let tile_sum0 = reduce_sum(prob0, tid${d});
    let tile_sum1 = reduce_sum(prob1, tid${d});
    let tile_sum2 = reduce_sum(prob2, tid${d});
    let tile_sum3 = reduce_sum(prob3, tid${d});
    if (tid == 0u) {
      running_denom0 = running_denom0 * scale_old0 + tile_sum0;
      running_denom1 = running_denom1 * scale_old1 + tile_sum1;
      running_denom2 = running_denom2 * scale_old2 + tile_sum2;
      running_denom3 = running_denom3 * scale_old3 + tile_sum3;
    }
    workgroupBarrier();

    let tile_count = min(K_TILE, seqLocal - kj_base);
    let scale_old_v0 = scale_old0;
    let scale_old_v1 = scale_old1;
    let scale_old_v2 = scale_old2;
    let scale_old_v3 = scale_old3;
    for (var d4: u32 = tid; d4 < HEAD_DIM_V4; d4 = d4 + WG) {
      var v_sum0: vec4<f32> = vec4<f32>(0.0);
      var v_sum1: vec4<f32> = vec4<f32>(0.0);
      var v_sum2: vec4<f32> = vec4<f32>(0.0);
      var v_sum3: vec4<f32> = vec4<f32>(0.0);
      for (var i: u32 = 0u; i < tile_count; i = i + 1u) {
        let vBaseV4 = ((kj_base + i) * params.kvHeads + hKv) * HEAD_DIM_V4;
        let vval = ${rn(`v[vBaseV4 + d4]`,n)};
        v_sum0 = v_sum0 + probs0[i] * vval;
        v_sum1 = v_sum1 + probs1[i] * vval;
        v_sum2 = v_sum2 + probs2[i] * vval;
        v_sum3 = v_sum3 + probs3[i] * vval;
      }
      let dBase = d4 * 4u;
      running_out0[dBase + 0u] = running_out0[dBase + 0u] * scale_old_v0 + v_sum0.x;
      running_out0[dBase + 1u] = running_out0[dBase + 1u] * scale_old_v0 + v_sum0.y;
      running_out0[dBase + 2u] = running_out0[dBase + 2u] * scale_old_v0 + v_sum0.z;
      running_out0[dBase + 3u] = running_out0[dBase + 3u] * scale_old_v0 + v_sum0.w;
      running_out1[dBase + 0u] = running_out1[dBase + 0u] * scale_old_v1 + v_sum1.x;
      running_out1[dBase + 1u] = running_out1[dBase + 1u] * scale_old_v1 + v_sum1.y;
      running_out1[dBase + 2u] = running_out1[dBase + 2u] * scale_old_v1 + v_sum1.z;
      running_out1[dBase + 3u] = running_out1[dBase + 3u] * scale_old_v1 + v_sum1.w;
      running_out2[dBase + 0u] = running_out2[dBase + 0u] * scale_old_v2 + v_sum2.x;
      running_out2[dBase + 1u] = running_out2[dBase + 1u] * scale_old_v2 + v_sum2.y;
      running_out2[dBase + 2u] = running_out2[dBase + 2u] * scale_old_v2 + v_sum2.z;
      running_out2[dBase + 3u] = running_out2[dBase + 3u] * scale_old_v2 + v_sum2.w;
      running_out3[dBase + 0u] = running_out3[dBase + 0u] * scale_old_v3 + v_sum3.x;
      running_out3[dBase + 1u] = running_out3[dBase + 1u] * scale_old_v3 + v_sum3.y;
      running_out3[dBase + 2u] = running_out3[dBase + 2u] * scale_old_v3 + v_sum3.z;
      running_out3[dBase + 3u] = running_out3[dBase + 3u] * scale_old_v3 + v_sum3.w;
    }
    workgroupBarrier();

    kj_base = kj_base + K_TILE;
  }

  let outBase0 = (qi0 * params.qHeads + h) * HEAD_DIM;
  let inv0 = 1.0 / running_denom0;
  for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
    out[outBase0 + d] = ${nn(`running_out0[d] * inv0`,r)};
  }
  if (q1_valid) {
    let outBase1 = (qi1 * params.qHeads + h) * HEAD_DIM;
    let inv1 = 1.0 / running_denom1;
    for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
      out[outBase1 + d] = ${nn(`running_out1[d] * inv1`,r)};
    }
  }
  if (q2_valid) {
    let outBase2 = (qi2 * params.qHeads + h) * HEAD_DIM;
    let inv2 = 1.0 / running_denom2;
    for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
      out[outBase2 + d] = ${nn(`running_out2[d] * inv2`,r)};
    }
  }
  if (q3_valid) {
    let outBase3 = (qi3 * params.qHeads + h) * HEAD_DIM;
    let inv3 = 1.0 / running_denom3;
    for (var d: u32 = tid; d < HEAD_DIM; d = d + WG) {
      out[outBase3 + d] = ${nn(`running_out3[d] * inv3`,r)};
    }
  }
}
`}function gn({headDim:e,kStep:t=32,inputDtype:n=`float16`,outputDtype:r=`float16`}){if(e%4!=0)throw Error(`headDim must be divisible by 4`);if(n!==`float16`)throw Error(`Q32 flash attention requires f16 Q/K/V inputs`);if(t!==32&&t!==64)throw Error(`Q32 flash attention supports kStep=32 or 64`);let i=e/4,a=$t(n),o=$t(r),s=[`x`,`y`,`z`,`w`],c=t/4,l=Array.from({length:c},(e,t)=>`    var qk${t}: vec4<f32> = vec4<f32>(0.0);`).join(`
`),u=Array.from({length:t},(e,t)=>{let n=Math.floor(t/4),r=s[t%4];return`        qk${n}.${r} = qk${n}.${r} + f32(dot(q_own, subgroupShuffle(${t<32?`k_local0`:`k_local1`}, ${t%32}u)));`}).join(`
`),d=Array.from({length:c},(e,t)=>{let n=[`    qk${t} = qk${t} * vec4<f32>(SCALE);`];for(let e=0;e<4;++e){let r=t*4+e;n.push(`    if (k_start + ${r}u >= seqLocal) { qk${t}.${s[e]} = NEG_INF; }`)}return n.join(`
`)}).join(`
`),f=Array.from({length:t},(e,t)=>{let n=Math.floor(t/4),r=s[t%4];return`      acc = acc + vec4<f32>(subgroupShuffle(${t<32?`v_local0`:`v_local1`}, ${t%32}u)) * qk${n}.${r};`}).join(`
`),p=t===32?`      var k_local0: vec4<f16> = vec4<f16>(0.0h);
      if (k_start + sg_id < seqLocal) {
        let kBaseV4 = ((k_start + sg_id) * params.kvHeads + hKv) * HEAD_DIM_V4;
        k_local0 = k[kBaseV4 + d4];
      }`:`      var k_local0: vec4<f16> = vec4<f16>(0.0h);
      var k_local1: vec4<f16> = vec4<f16>(0.0h);
      if (k_start + sg_id < seqLocal) {
        let kBaseV4 = ((k_start + sg_id) * params.kvHeads + hKv) * HEAD_DIM_V4;
        k_local0 = k[kBaseV4 + d4];
      }
      if (k_start + sg_id + 32u < seqLocal) {
        let kBaseV4 = ((k_start + sg_id + 32u) * params.kvHeads + hKv) * HEAD_DIM_V4;
        k_local1 = k[kBaseV4 + d4];
      }`,m=t===32?`      var v_local0: vec4<f16> = vec4<f16>(0.0h);
      if (k_start + sg_id < seqLocal) {
        let vBaseV4 = ((k_start + sg_id) * params.kvHeads + hKv) * HEAD_DIM_V4;
        v_local0 = v[vBaseV4 + d4];
      }`:`      var v_local0: vec4<f16> = vec4<f16>(0.0h);
      var v_local1: vec4<f16> = vec4<f16>(0.0h);
      if (k_start + sg_id < seqLocal) {
        let vBaseV4 = ((k_start + sg_id) * params.kvHeads + hKv) * HEAD_DIM_V4;
        v_local0 = v[vBaseV4 + d4];
      }
      if (k_start + sg_id + 32u < seqLocal) {
        let vBaseV4 = ((k_start + sg_id + 32u) * params.kvHeads + hKv) * HEAD_DIM_V4;
        v_local1 = v[vBaseV4 + d4];
      }`,h=r===`float16`?`    out[outBaseV4 + d4] = vec4<f16>(o_tile[d4]);`:`    out[outBaseV4 + d4] = o_tile[d4];`,g=Array.from({length:c},(e,t)=>`    local_max = max(local_max, max(max(qk${t}.x, qk${t}.y), max(qk${t}.z, qk${t}.w)));`).join(`
`),_=Array.from({length:c},(e,t)=>`    qk${t} = exp(qk${t} - vec4<f32>(new_max));`).join(`
`),v=Array.from({length:c},(e,t)=>`    tile_sum = tile_sum + qk${t}.x + qk${t}.y + qk${t}.z + qk${t}.w;`).join(`
`),y=Array.from({length:c},(e,t)=>`    qk${t} = qk${t} / vec4<f32>(denom);`).join(`
`);return`${en(n,r)}enable subgroups;
struct Params { seq: u32, qHeads: u32, kvHeads: u32, _pad0: u32 };
@group(0) @binding(0) var<storage, read>       q: array<vec4<${a}>>;
@group(0) @binding(1) var<storage, read>       k: array<vec4<${a}>>;
@group(0) @binding(2) var<storage, read>       v: array<vec4<${a}>>;
@group(0) @binding(3) var<storage, read_write> out: array<vec4<${o}>>;
@group(0) @binding(4) var<uniform>             params: Params;

const HEAD_DIM:    u32 = ${e}u;
const HEAD_DIM_V4: u32 = ${i}u;
const WG:          u32 = 32u;
const K_STEP:      u32 = ${t}u;
const SCALE:       f32 = ${(1/Math.sqrt(e)).toFixed(8)};
const NEG_INF:     f32 = -3.4e38;

@compute @workgroup_size(WG, 1, 1)
fn main(
  @builtin(workgroup_id) wg: vec3<u32>,
  @builtin(local_invocation_id) lid: vec3<u32>,
  @builtin(subgroup_invocation_id) sg_id: u32
) {
  let qi = wg.x * WG + lid.x;
  let h = wg.y;
  if (h >= params.qHeads) { return; }
  let valid_q = qi < params.seq;
  let kvGroupSize = params.qHeads / params.kvHeads;
  let hKv = h / kvGroupSize;
  let qBaseV4 = (qi * params.qHeads + h) * HEAD_DIM_V4;

  var q_tile: array<vec4<f16>, HEAD_DIM_V4>;
  var o_tile: array<vec4<f32>, HEAD_DIM_V4>;
  for (var d4: u32 = 0u; d4 < HEAD_DIM_V4; d4 = d4 + 1u) {
    if (valid_q) {
      q_tile[d4] = q[qBaseV4 + d4];
    } else {
      q_tile[d4] = vec4<f16>(0.0h);
    }
    o_tile[d4] = vec4<f32>(0.0);
  }

  var previous_max: f32 = NEG_INF;
  var previous_denom: f32 = 0.0;
  let seqLocal = params.seq;
  for (var k_start: u32 = 0u; k_start < seqLocal; k_start = k_start + K_STEP) {
${l}
    for (var d4: u32 = 0u; d4 < HEAD_DIM_V4; d4 = d4 + 1u) {
      let q_own = q_tile[d4];
${p}
${u}
    }
${d}

    var local_max: f32 = NEG_INF;
${g}
    let new_max = max(previous_max, local_max);
${_}
    var tile_sum: f32 = 0.0;
${v}
    let dleft = previous_denom * exp(previous_max - new_max);
    let denom = max(dleft + tile_sum, 0.0000001);
    let o_ratio = dleft / denom;
${y}
    previous_max = new_max;
    previous_denom = denom;

    for (var d4: u32 = 0u; d4 < HEAD_DIM_V4; d4 = d4 + 1u) {
${m}
      var acc: vec4<f32> = vec4<f32>(0.0);
${f}
      o_tile[d4] = o_tile[d4] * vec4<f32>(o_ratio) + acc;
    }
  }

  if (valid_q) {
    let outBaseV4 = (qi * params.qHeads + h) * HEAD_DIM_V4;
    for (var d4: u32 = 0u; d4 < HEAD_DIM_V4; d4 = d4 + 1u) {
${h}
    }
  }
}
`}function _n({dtype:e=`float32`}={}){let t=$t(e);return`${en(e)}struct Params { totalElems: u32, aElems: u32, wgY: u32, _pad0: u32 };
@group(0) @binding(0) var<storage, read>       a: array<${t}>;
@group(0) @binding(1) var<storage, read>       b: array<${t}>;
@group(0) @binding(2) var<storage, read_write> out: array<${t}>;
@group(0) @binding(3) var<uniform>             params: Params;
const WG: u32 = 64u;
@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let i = wg_idx * WG + lid.x;
  if (i >= params.totalElems) { return; }
  if (i < params.aElems) {
    out[i] = a[i];
  } else {
    out[i] = b[i - params.aElems];
  }
}
`}function vn({bits:e,groupSize:t,inFeatures:n,outFeatures:r,label:i=`mlx_matmul`}){if(![1,2,4,8].includes(e))throw Error(`unsupported bits=${e}`);if(n%t!==0)throw Error(`inFeatures must be divisible by groupSize`);let a=Math.floor(32/e);if(t%a!==0)throw Error(`groupSize must be divisible by valsPerWord`);let o=t/a,s=n/a;return`// MLX matmul, bits=${e}, group_size=${t}, in=${n}, out=${r}.
struct Params { M: u32 };
@group(0) @binding(0) var<storage, read>       a:         array<f32>;
@group(0) @binding(1) var<storage, read>       bits_buf:  array<u32>;
@group(0) @binding(2) var<storage, read>       scaleBias: array<f32>;
@group(0) @binding(3) var<storage, read_write> y:         array<f32>;
@group(0) @binding(4) var<uniform>             params:    Params;

const IN_FEATURES:     u32 = ${n}u;
const OUT_FEATURES:    u32 = ${r}u;
const GROUP_SIZE:      u32 = ${t}u;
const NUM_GROUPS:      u32 = ${n/t}u;
const WORDS_PER_ROW:   u32 = ${s}u;
const WORDS_PER_GROUP: u32 = ${o}u;
const VALS_PER_WORD:   u32 = ${a}u;
const BITS:            u32 = ${e}u;
const MASK:            u32 = ${(1<<e)-1}u;
const WG_SIZE:         u32 = 64u;

var<workgroup> partial_acc: array<f32, WG_SIZE>;

@compute @workgroup_size(WG_SIZE, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let row: u32 = wg.x;            // output feature
  let mrow: u32 = wg.y;           // input row (token index)
  if (row >= OUT_FEATURES || mrow >= params.M) { return; }
  let tid: u32 = lid.x;

  let row_words_base: u32 = row * WORDS_PER_ROW;
  let row_sb_base:    u32 = row * NUM_GROUPS * 2u;
  let a_row_base:     u32 = mrow * IN_FEATURES;

  var thread_acc: f32 = 0.0;
  var g: u32 = tid;
  loop {
    if (g >= NUM_GROUPS) { break; }
    let group_word_base: u32 = row_words_base + g * WORDS_PER_GROUP;
    let col_base: u32 = g * GROUP_SIZE;

    var sum_qa: f32 = 0.0;
    var sum_a:  f32 = 0.0;
    for (var w: u32 = 0u; w < WORDS_PER_GROUP; w = w + 1u) {
      let packed: u32 = bits_buf[group_word_base + w];
      let lane_base: u32 = col_base + w * VALS_PER_WORD;
      for (var v: u32 = 0u; v < VALS_PER_WORD; v = v + 1u) {
        let q: f32 = f32((packed >> (v * BITS)) & MASK);
        let ai: f32 = a[a_row_base + lane_base + v];
        sum_qa = sum_qa + q * ai;
        sum_a  = sum_a  + ai;
      }
    }
    let scale: f32 = scaleBias[row_sb_base + g * 2u];
    let bias:  f32 = scaleBias[row_sb_base + g * 2u + 1u];
    thread_acc = thread_acc + scale * sum_qa + bias * sum_a;

    g = g + WG_SIZE;
  }

  partial_acc[tid] = thread_acc;
  workgroupBarrier();

  var stride: u32 = WG_SIZE / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      partial_acc[tid] = partial_acc[tid] + partial_acc[tid + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }

  if (tid == 0u) {
    y[mrow * OUT_FEATURES + row] = partial_acc[0];
  }
}
`}function yn({bits:e,groupSize:t,inFeatures:n,outFeatures:r,mTile:i=4,outTile:a=64,kGroupsPerChunk:o=2,nPerThread:s=1,inputDtype:c=`float32`,outputDtype:l=`float32`,scaleBiasDtype:u=`float32`}){if(![1,2,4,8].includes(e))throw Error(`unsupported bits=${e}`);if(n%t!==0)throw Error(`inFeatures must be divisible by groupSize`);let d=Math.floor(32/e);if(t%d!==0)throw Error(`groupSize must be divisible by valsPerWord`);if(t%4!=0)throw Error(`groupSize must be divisible by 4 for vec4 loads`);let f=t/d,p=n/d,m=n/t;if(m%o!==0)throw Error(`numGroups=${m} not divisible by kGroupsPerChunk=${o}`);let h=m/o,g=t*o,_=(1<<e)-1,v=i*a,y=c===`float16`?`f16`:`f32`,b=u===`float16`?`f16`:`f32`,x=l===`float16`?`f16`:`f32`,S=c===`float16`||l===`float16`||u===`float16`?`enable f16;
`:``,C=l===`float16`?`f16(thread_accs[nn])`:`thread_accs[nn]`;if(v>256)throw Error(`mTile * outTile = ${v} exceeds maxComputeInvocationsPerWorkgroup=256`);let w=i*g/4;if(d%4!=0)throw Error(`valsPerWord must be divisible by 4`);let T=d/4,E=a*s,D=[];for(let t=0;t<T;t++){let n=n=>`(packed >> ${(t*4+n)*e}u) & ${_}u`;D.push(`let q${t}: vec4<f32> = vec4<f32>(f32(${n(0)}), f32(${n(1)}), f32(${n(2)}), f32(${n(3)}));`)}let O=``;for(let e=0;e<T;e++)O+=`          ${D[e]}
`,O+=`          let a${e}: vec4<f32> = vec4<f32>(a_chunk[a_vec_off + ${e}u]);
`,O+=`          sum_qa = sum_qa + dot(q${e}, a${e});
`,O+=`          sum_a  = sum_a  + dot(vec4<f32>(1.0, 1.0, 1.0, 1.0), a${e});
`;return`// MLX matmul tiled, bits=${e}, group_size=${t}, in=${n}, out=${r}, mTile=${i}, outTile=${a}, kGroupsPerChunk=${o}, nPerThread=${s}, input=${c}, scaleBias=${u}, output=${l}.
${S}struct Params { M: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       a:         array<vec4<${y}>>;
@group(0) @binding(1) var<storage, read>       bits_buf:  array<u32>;
@group(0) @binding(2) var<storage, read>       scaleBias: array<${b}>;
@group(0) @binding(3) var<storage, read_write> y:         array<${x}>;
@group(0) @binding(4) var<uniform>             params:    Params;

const IN_FEATURES:     u32 = ${n}u;
const IN_FEATURES_V4:  u32 = ${n/4}u;
const OUT_FEATURES:    u32 = ${r}u;
const GROUP_SIZE:      u32 = ${t}u;
const GROUP_SIZE_V4:   u32 = ${t/4}u;
const NUM_GROUPS:      u32 = ${m}u;
const WORDS_PER_ROW:   u32 = ${p}u;
const WORDS_PER_GROUP: u32 = ${f}u;
const VEC4_PER_WORD:   u32 = ${T}u;
const BITS:            u32 = ${e}u;
const MASK:            u32 = ${_}u;
const M_TILE:          u32 = ${i}u;
const OUT_TILE:        u32 = ${a}u;
const N_PER_THREAD:    u32 = ${s}u;
const OUT_TILE_TOTAL:  u32 = ${E}u;
const WG_SIZE:         u32 = ${v}u;
const A_CHUNK_VEC4:    u32 = ${w}u;
const NUM_CHUNKS:      u32 = ${h}u;
const K_GROUPS_PER_CHUNK: u32 = ${o}u;
const CHUNK_GROUP_SIZE_V4: u32 = ${g/4}u;

var<workgroup> a_chunk: array<vec4<${y}>, A_CHUNK_VEC4>;

@compute @workgroup_size(WG_SIZE, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let n_block: u32 = wg.x * OUT_TILE_TOTAL;
  let m_block: u32 = wg.y * M_TILE;
  let tid: u32 = lid.x;

  let m_local: u32 = tid / OUT_TILE;   // 0..M_TILE-1
  let n_local0: u32 = tid % OUT_TILE;  // 0..OUT_TILE-1
  let m_row: u32 = m_block + m_local;

  let m_valid: bool = m_row < params.M;

  // Each thread computes N_PER_THREAD outputs, spaced by OUT_TILE within n_block.
  var thread_accs: array<f32, N_PER_THREAD>;
  for (var nn: u32 = 0u; nn < N_PER_THREAD; nn = nn + 1u) {
    thread_accs[nn] = 0.0;
  }

  for (var chunk: u32 = 0u; chunk < NUM_CHUNKS; chunk = chunk + 1u) {
    let chunk_k_vec_base: u32 = chunk * CHUNK_GROUP_SIZE_V4;
    for (var i: u32 = tid; i < A_CHUNK_VEC4; i = i + WG_SIZE) {
      let mi: u32 = i / CHUNK_GROUP_SIZE_V4;
      let kvi: u32 = i % CHUNK_GROUP_SIZE_V4;
      let src_m: u32 = m_block + mi;
      if (src_m < params.M) {
        a_chunk[i] = a[src_m * IN_FEATURES_V4 + chunk_k_vec_base + kvi];
      } else {
        a_chunk[i] = vec4<${y}>(0.0);
      }
    }
    workgroupBarrier();

    let chunk_g0: u32 = chunk * K_GROUPS_PER_CHUNK;
    for (var nn: u32 = 0u; nn < N_PER_THREAD; nn = nn + 1u) {
      let n_row: u32 = n_block + nn * OUT_TILE + n_local0;
      if (n_row < OUT_FEATURES) {
        let row_words_base: u32 = n_row * WORDS_PER_ROW;
        let row_sb_base: u32 = n_row * NUM_GROUPS * 2u;
        for (var gi: u32 = 0u; gi < K_GROUPS_PER_CHUNK; gi = gi + 1u) {
          let g: u32 = chunk_g0 + gi;
          let group_word_base: u32 = row_words_base + g * WORDS_PER_GROUP;
          let a_vec_base: u32 = m_local * CHUNK_GROUP_SIZE_V4 + gi * GROUP_SIZE_V4;
          var sum_qa: f32 = 0.0;
          var sum_a:  f32 = 0.0;
          for (var w: u32 = 0u; w < WORDS_PER_GROUP; w = w + 1u) {
            let packed: u32 = bits_buf[group_word_base + w];
            let a_vec_off: u32 = a_vec_base + w * VEC4_PER_WORD;
${O}        }
          let scale: f32 = f32(scaleBias[row_sb_base + g * 2u]);
          let bias:  f32 = f32(scaleBias[row_sb_base + g * 2u + 1u]);
          thread_accs[nn] = thread_accs[nn] + scale * sum_qa + bias * sum_a;
        }
      }
    }
    workgroupBarrier();
  }

  if (m_valid) {
    for (var nn: u32 = 0u; nn < N_PER_THREAD; nn = nn + 1u) {
      let n_row: u32 = n_block + nn * OUT_TILE + n_local0;
      if (n_row < OUT_FEATURES) {
        y[m_row * OUT_FEATURES + n_row] = ${C};
      }
    }
  }
}
`}function bn({inFeatures:e,outFeatures:t,tileM:n=10,tileN:r=256,nPerThread:i=1,assumeBiasNegHalfScale:a=!1,scaleOnly:o=!1}){if(e%128!=0)throw Error(`binary LUT matmul requires K divisible by 128`);if(!Number.isInteger(i)||i<1)throw Error(`binary LUT matmul requires nPerThread >= 1`);if(r%i!==0)throw Error(`binary LUT matmul tileN must be divisible by nPerThread`);let s=r/i;if(s>256)throw Error(`binary LUT matmul workgroup size exceeds max workgroup invocations`);let c=e/128,l=e/4,u=n*32*16,d=n*32,f=u*2+(a?0:n*4);if(f>16*1024)throw Error(`binary LUT matmul uses ${f} bytes of workgroup storage`);let p=Array.from({length:i},(e,t)=>Array.from({length:n},(e,n)=>`  var acc${t}_${n}: f32 = 0.0;`).join(`
`)).join(`
`),m=e=>Array.from({length:n},(t,n)=>`      var qa${e}_${n}: f32 = 0.0;`).join(`
`),h=e=>Array.from({length:4},(t,r)=>Array.from({length:4},(t,i)=>{let a=r*8+i*2;return`      {
        let byte${r}_${i}: u32 = (p${r} >> ${i*8}u) & 0xffu;
        let lo${r}_${i}: u32 = byte${r}_${i} & 0x0fu;
        let hi${r}_${i}: u32 = byte${r}_${i} >> 4u;
${Array.from({length:n},(t,n)=>`        qa${e}_${n} = qa${e}_${n} + f32(lut[lutIndex(${n}u, ${a}u, lo${r}_${i})]) + f32(lut[lutIndex(${n}u, ${a+1}u, hi${r}_${i})]);`).join(`
`)}
      }`}).join(`
`)).join(`
`),g=e=>a?o?`      let scale: f32 = f32(scaleBias[n${e} * NUM_GROUPS + g]);`:`      let scale: f32 = f32(scaleBias[sb]);`:`      let scale: f32 = f32(scaleBias[sb]);
      let bias: f32 = f32(scaleBias[sb + 1u]);`,_=e=>Array.from({length:n},(t,n)=>a?`      acc${e}_${n} = acc${e}_${n} + scale * qa${e}_${n};`:`      acc${e}_${n} = acc${e}_${n} + scale * qa${e}_${n} + bias * sumA[${n}u];`).join(`
`),v=Array.from({length:i},(e,t)=>`  let n${t}: u32 = n_base + ${t}u * WG_SIZE;
  let n${t}_valid: bool = n${t} < OUT_FEATURES;`).join(`
`),y=Array.from({length:i},(e,t)=>`    if (n${t}_valid) {
      let packed: vec4<u32> = bits_buf[n${t} * NUM_GROUPS + g];
      let p0: u32 = packed.x;
      let p1: u32 = packed.y;
      let p2: u32 = packed.z;
      let p3: u32 = packed.w;
      let sb: u32 = (n${t} * NUM_GROUPS + g) * 2u;
${g(t)}
${m(t)}
${h(t)}
${_(t)}
    }`).join(`
`),b=Array.from({length:i},(e,t)=>`  if (n${t}_valid) {
${Array.from({length:n},(e,n)=>`    { let mr: u32 = m_block + ${n}u; if (mr < params.M) { y[mr * OUT_FEATURES + n${t}] = f16(acc${t}_${n}); } }`).join(`
`)}
  }`).join(`
`),x=a?`      let c: f32 = 0.5 * (x + yv + z + wv);
      lut[base] = f16(-c);
      lut[base + 1u] = f16(x - c);
      lut[base + 2u] = f16(yv - c);
      lut[base + 3u] = f16(xy - c);
      lut[base + 4u] = f16(z - c);
      lut[base + 5u] = f16(xz - c);
      lut[base + 6u] = f16(yz - c);
      lut[base + 7u] = f16(xyz - c);
      lut[base + 8u] = f16(wv - c);
      lut[base + 9u] = f16(x + wv - c);
      lut[base + 10u] = f16(yv + wv - c);
      lut[base + 11u] = f16(xy + wv - c);
      lut[base + 12u] = f16(z + wv - c);
      lut[base + 13u] = f16(xz + wv - c);
      lut[base + 14u] = f16(yz + wv - c);
      lut[base + 15u] = f16(xyz + wv - c);`:`      lut[base] = 0.0h;
      lut[base + 1u] = f16(x);
      lut[base + 2u] = f16(yv);
      lut[base + 3u] = f16(xy);
      lut[base + 4u] = f16(z);
      lut[base + 5u] = f16(xz);
      lut[base + 6u] = f16(yz);
      lut[base + 7u] = f16(xyz);
      lut[base + 8u] = f16(wv);
      lut[base + 9u] = f16(x + wv);
      lut[base + 10u] = f16(yv + wv);
      lut[base + 11u] = f16(xy + wv);
      lut[base + 12u] = f16(z + wv);
      lut[base + 13u] = f16(xz + wv);
      lut[base + 14u] = f16(yz + wv);
      lut[base + 15u] = f16(xyz + wv);`;return`enable f16;
struct Params { M: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       a:         array<vec4<f16>>;
@group(0) @binding(1) var<storage, read>       bits_buf:  array<vec4<u32>>;
@group(0) @binding(2) var<storage, read>       scaleBias: array<f16>;
@group(0) @binding(3) var<storage, read_write> y:         array<f16>;
@group(0) @binding(4) var<uniform>             params:    Params;

const IN_FEATURES:    u32 = ${e}u;
const IN_FEATURES_V4: u32 = ${l}u;
const OUT_FEATURES:   u32 = ${t}u;
const NUM_GROUPS:     u32 = ${c}u;
const M_TILE:         u32 = ${n}u;
const N_TILE:         u32 = ${r}u;
const WG_SIZE:        u32 = ${s}u;
const LUT_ENTRIES:    u32 = ${u}u;
const LUT_NIBBLES:    u32 = ${d}u;

var<workgroup> lut: array<f16, ${u}>;
${a?``:`var<workgroup> sumA: array<f32, ${n}>;
`}

fn lutIndex(m: u32, nibble: u32, mask: u32) -> u32 {
  return (m * 32u + nibble) * 16u + mask;
}

@compute @workgroup_size(${s}, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let tid: u32 = lid.x;
  let n_block: u32 = wg.x * N_TILE;
  let m_block: u32 = wg.y * M_TILE;
  let n_base: u32 = n_block + tid;
${v}

${p}

  for (var g: u32 = 0u; g < NUM_GROUPS; g = g + 1u) {
    for (var i: u32 = tid; i < LUT_NIBBLES; i = i + WG_SIZE) {
      let nibble: u32 = i & 31u;
      let m_local: u32 = i >> 5u;
      let m: u32 = m_block + m_local;
      var v: vec4<f16> = vec4<f16>(0.0h);
      if (m < params.M) {
        v = a[m * IN_FEATURES_V4 + g * 32u + nibble];
      }
      let x: f32 = f32(v.x);
      let yv: f32 = f32(v.y);
      let z: f32 = f32(v.z);
      let wv: f32 = f32(v.w);
      let xy: f32 = x + yv;
      let xz: f32 = x + z;
      let yz: f32 = yv + z;
      let xyz: f32 = xy + z;
      let base: u32 = (m_local * 32u + nibble) * 16u;
${x}
    }
    workgroupBarrier();
${a?``:`
    for (var mi: u32 = tid; mi < M_TILE; mi = mi + WG_SIZE) {
      var s: f32 = 0.0;
      for (var nibble: u32 = 0u; nibble < 32u; nibble = nibble + 1u) {
        s = s + f32(lut[lutIndex(mi, nibble, 15u)]);
      }
      sumA[mi] = s;
    }
    workgroupBarrier();
`}

${y}
    workgroupBarrier();
  }

${b}
}
`}function xn({inFeatures:e,groupSize:t,inputDtype:n=`float32`}){if(e%t!==0)throw Error(`inFeatures must be divisible by groupSize`);if(t%16!=0)throw Error(`groupSize must be divisible by 16 (packs of 4 i8)`);if(t%4!=0)throw Error(`groupSize must be divisible by 4 (vec4 loads)`);if(n!==`float32`&&n!==`float16`)throw Error(`unsupported quantize-A input dtype: ${n}`);let r=e/t,i=t/4,a=t/4,o=Math.min(32,t/4),s=t/o,c=n===`float16`?`f16`:`f32`,l=n===`float16`?`enable f16;
`:``,u=e=>n===`float16`?`vec4<f32>(${e})`:e;return`${l}// Quantize A ${n} \u2192 i8, per-block scale + per-block sum.
struct Params { M: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       a:       array<vec4<${c}>>;
@group(0) @binding(1) var<storage, read_write> a_i8:    array<u32>;
@group(0) @binding(2) var<storage, read_write> scale_a: array<f32>;
@group(0) @binding(3) var<storage, read_write> sum_a:   array<f32>;
@group(0) @binding(4) var<uniform>             params:  Params;

const IN_FEATURES:   u32 = ${e}u;
const IN_FEATURES_V4: u32 = ${e/4}u;
const GROUP_SIZE:    u32 = ${t}u;
const GROUP_SIZE_V4: u32 = ${i}u;
const NUM_GROUPS:    u32 = ${r}u;
const U32_PER_GROUP: u32 = ${a}u;
const WG:            u32 = ${o}u;
const ELS_PER_THREAD: u32 = ${s}u;

var<workgroup> partial_max: array<f32, WG>;
var<workgroup> partial_sum: array<f32, WG>;
var<workgroup> group_scale: f32;

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let m_row: u32 = wg.y;
  let g: u32 = wg.x;
  let tid: u32 = lid.x;
  if (m_row >= params.M) { return; }

  let group_k_v4_base: u32 = m_row * IN_FEATURES_V4 + g * GROUP_SIZE_V4;
  let thread_v4_start: u32 = tid * (ELS_PER_THREAD / 4u);
  var local_max: f32 = 0.0;
  var local_sum: f32 = 0.0;
  var v0: vec4<f32>;
  var v1: vec4<f32>;
  v0 = ${u(`a[group_k_v4_base + thread_v4_start]`)};
  local_max = max(local_max, max(max(abs(v0.x), abs(v0.y)), max(abs(v0.z), abs(v0.w))));
  local_sum = local_sum + v0.x + v0.y + v0.z + v0.w;
${s===8?`  v1 = ${u(`a[group_k_v4_base + thread_v4_start + 1u]`)};
  local_max = max(local_max, max(max(abs(v1.x), abs(v1.y)), max(abs(v1.z), abs(v1.w))));
  local_sum = local_sum + v1.x + v1.y + v1.z + v1.w;`:``}

  partial_max[tid] = local_max;
  partial_sum[tid] = local_sum;
  workgroupBarrier();
  var stride: u32 = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      let other = partial_max[tid + stride];
      if (other > partial_max[tid]) { partial_max[tid] = other; }
      partial_sum[tid] = partial_sum[tid] + partial_sum[tid + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  if (tid == 0u) {
    let m = partial_max[0];
    if (m > 0.0) {
      group_scale = m / 127.0;
    } else {
      group_scale = 1.0;
    }
    scale_a[m_row * NUM_GROUPS + g] = group_scale;
    sum_a[m_row * NUM_GROUPS + g] = partial_sum[0];
  }
  workgroupBarrier();
  let inv_scale: f32 = 1.0 / group_scale;
  let q0 = clamp(round(v0.x * inv_scale), -128.0, 127.0);
  let q1 = clamp(round(v0.y * inv_scale), -128.0, 127.0);
  let q2 = clamp(round(v0.z * inv_scale), -128.0, 127.0);
  let q3 = clamp(round(v0.w * inv_scale), -128.0, 127.0);
  let u32_0: u32 = pack4xI8(vec4<i32>(i32(q0), i32(q1), i32(q2), i32(q3)));
  let out_base: u32 = (m_row * NUM_GROUPS + g) * U32_PER_GROUP;
  a_i8[out_base + thread_v4_start] = u32_0;
${s===8?`  let q4 = clamp(round(v1.x * inv_scale), -128.0, 127.0);
  let q5 = clamp(round(v1.y * inv_scale), -128.0, 127.0);
  let q6 = clamp(round(v1.z * inv_scale), -128.0, 127.0);
  let q7 = clamp(round(v1.w * inv_scale), -128.0, 127.0);
  let u32_1: u32 = pack4xI8(vec4<i32>(i32(q4), i32(q5), i32(q6), i32(q7)));
  a_i8[out_base + thread_v4_start + 1u] = u32_1;`:``}
}
`}function Sn({bits:e,groupSize:t,inFeatures:n,outFeatures:r,scaleBiasDtype:i=`float16`,scaleBiasLayout:a=`out-group`,outputLayout:o=`out-k`,assumeTernaryBias:s=!1}){if(![1,2,4,8].includes(e))throw Error(`unsupported bits=${e}`);if(s&&e!==2)throw Error(`assumeTernaryBias is only valid for 2-bit MLX weights`);if(n%t!==0)throw Error(`inFeatures must be divisible by groupSize`);if(i!==`float32`&&i!==`float16`&&i!==`bfloat16`)throw Error(`unsupported scaleBias dtype: ${i}`);if(a!==`out-group`&&a!==`group-out`)throw Error(`unsupported scaleBias layout: ${a}`);if(o!==`out-k`&&o!==`k-out`)throw Error(`unsupported output layout: ${o}`);let c=Math.floor(32/e),l=n/c,u=n/t,d=(1<<e)-1,f=i===`bfloat16`?`u32`:i===`float16`?`f16`:`f32`,p=s?`1u`:`2u`,m=a===`group-out`?`let sb_idx: u32 = (g * OUT_FEATURES + row) * ${p};`:`let sb_idx: u32 = (row * NUM_GROUPS + g) * ${p};`;return`enable f16;
struct Params { count: u32, wgY: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       bits_buf:  array<u32>;
@group(0) @binding(1) var<storage, read>       scaleBias: array<${f}>;
@group(0) @binding(2) var<storage, read_write> out:       array<f16>;
@group(0) @binding(3) var<uniform>             params:    Params;

${i===`bfloat16`?`
fn loadBf16(idx: u32) -> f32 {
  let packed = scaleBias[idx / 2u];
  let half = select(packed & 0xffffu, packed >> 16u, (idx & 1u) == 1u);
  return bitcast<f32>(half << 16u);
}
`:``}

const IN_FEATURES:   u32 = ${n}u;
const OUT_FEATURES:  u32 = ${r}u;
const GROUP_SIZE:    u32 = ${t}u;
const NUM_GROUPS:    u32 = ${u}u;
const VALS_PER_WORD: u32 = ${c}u;
const WORDS_PER_ROW: u32 = ${l}u;
const MASK:          u32 = ${d}u;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let idx = wg_idx * 64u + lid.x;
  if (idx >= params.count) { return; }
  let row = idx / WORDS_PER_ROW;
  let word = idx - row * WORDS_PER_ROW;
  let k_base = word * VALS_PER_WORD;
  let g = k_base / GROUP_SIZE;
  ${m}
  let scale_g: f32 = ${i===`bfloat16`?`loadBf16(sb_idx)`:`f32(scaleBias[sb_idx])`};
  ${s?`let bias_g: f32 = -scale_g;`:`let bias_g: f32 = ${i===`bfloat16`?`loadBf16(sb_idx + 1u)`:`f32(scaleBias[sb_idx + 1u])`};`}
  let packed = bits_buf[idx];
${Array.from({length:c},(t,n)=>`  out[${o===`k-out`?`(k_base + ${n}u) * OUT_FEATURES + row`:`row * IN_FEATURES + k_base + ${n}u`}] = f16(scale_g * f32((packed >> ${n*e}u) & MASK) + bias_g);`).join(`
`)}
}
`}function Cn({bits:e,groupSize:t,inFeatures:n,outFeatures:r,tileM:i=2,tileN:a=64,outputDtype:o=`float32`,scaleBiasDtype:s=`float32`}){if(e!==2)throw Error(`DP4A kernel currently only supports bits=2`);if(t!==128)throw Error(`DP4A kernel currently only supports groupSize=128`);if(n%t!==0)throw Error(`inFeatures must be divisible by groupSize`);if(o!==`float32`&&o!==`float16`)throw Error(`unsupported DP4A output dtype: ${o}`);if(s!==`float32`&&s!==`float16`)throw Error(`unsupported DP4A scaleBias dtype: ${s}`);let c=n/t,l=t/4;t/16;let u=n/16,d=u/4;if(u%4!=0)throw Error(`wordsPerRow must be divisible by 4 for vec4<u32> loads`);let f=l/4,p=a;if(p>256)throw Error(`tileN=${a} exceeds 256`);let m=o===`float16`?`f16`:`f32`,h=s===`float16`?`f16`:`f32`,g=o===`float16`||s===`float16`?`enable f16;
`:``,_=e=>o===`float16`?`f16(${e})`:e;i*f;let v=Array.from({length:i},(e,t)=>`  var r${t}: i32 = 0;`).join(`
`),y=Array.from({length:i},(e,t)=>`  var y${t}: f32 = 0.0;`).join(`
`);function b(e){let t=``;t+=`        let b_vec_h${e}: vec4<u32> = b_quad_${e};
`,t+=`        let p${e}_0: u32 = b_vec_h${e}[0u];
`,t+=`        let p${e}_1: u32 = b_vec_h${e}[1u];
`,t+=`        let p${e}_2: u32 = b_vec_h${e}[2u];
`,t+=`        let p${e}_3: u32 = b_vec_h${e}[3u];
`;for(let n=0;n<4;n++)for(let r=0;r<4;r++)t+=`        let b_byte_${e}_${n}_${r}: u32 = (p${e}_${n} >> ${r*8}u) & 0xFFu;
`,t+=`        let qb_${e}_${n}_${r}: u32 = (b_byte_${e}_${n}_${r} & 0x03u) | ((b_byte_${e}_${n}_${r} & 0x0Cu) << 6u) | ((b_byte_${e}_${n}_${r} & 0x30u) << 12u) | ((b_byte_${e}_${n}_${r} & 0xC0u) << 18u);
`;for(let n=0;n<i;n++){let r=`(${n}u * AU32_PER_GROUP) + ${e}u * 16u`;for(let i=0;i<4;i++)for(let a=0;a<4;a++)t+=`        r${n} = r${n} + dot4I8Packed(a_tile[${r} + ${i*4+a}u], qb_${e}_${i}_${a});
`}return t}let x=Array.from({length:i},(e,t)=>`      {
        let sa_mg: f32 = scale_a[(m_block + ${t}u) * NUM_GROUPS + g];
        let raw_sum: f32 = sum_a[(m_block + ${t}u) * NUM_GROUPS + g];
        y${t} = y${t} + sa_mg * scale_g * f32(r${t}) + bias_g * raw_sum;
        r${t} = 0;
      }`).join(`
`),S=Array.from({length:i},(e,t)=>`    { let mr: u32 = m_block + ${t}u; if (mr < params.M) { y[mr * OUT_FEATURES + n_row] = ${_(`y${t}`)}; } }`).join(`
`);return`${g}// DP4A MLX matmul, bits=2, gs=128, in=${n}, out=${r}, tileM=${i}, tileN=${a}, scaleBias=${s}, output=${o}.
struct Params { M: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       a_i8:     array<u32>;
@group(0) @binding(1) var<storage, read>       scale_a:  array<f32>;
@group(0) @binding(2) var<storage, read>       sum_a:    array<f32>;
@group(0) @binding(3) var<storage, read>       bits_buf: array<vec4<u32>>;
@group(0) @binding(4) var<storage, read>       scaleBias: array<${h}>;
@group(0) @binding(5) var<storage, read_write> y:        array<${m}>;
@group(0) @binding(6) var<uniform>             params:   Params;

const IN_FEATURES:       u32 = ${n}u;
const OUT_FEATURES:      u32 = ${r}u;
const GROUP_SIZE:        u32 = ${t}u;
const NUM_GROUPS:        u32 = ${c}u;
const WORDS_PER_ROW_V4:  u32 = ${d}u;
const AU32_PER_GROUP:    u32 = ${l}u;
const A_TILE_U32:        u32 = ${i*l}u;
const TILE_M:            u32 = ${i}u;
const TILE_N:            u32 = ${a}u;
const WG_SIZE:           u32 = ${p}u;

var<workgroup> a_tile: array<u32, A_TILE_U32>;

@compute @workgroup_size(WG_SIZE, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let n_block: u32 = wg.x * TILE_N;
  let m_block: u32 = wg.y * TILE_M;
  let tid: u32 = lid.x;
  let n_row: u32 = n_block + tid;
  let n_valid: bool = n_row < OUT_FEATURES;

${v}
${y}

  for (var g: u32 = 0u; g < NUM_GROUPS; g = g + 1u) {
    // Load A tile: TILE_M rows \xD7 AU32_PER_GROUP u32 from a_i8.
    let a_global_base: u32 = m_block * NUM_GROUPS * AU32_PER_GROUP + g * AU32_PER_GROUP;
    let a_group_stride: u32 = NUM_GROUPS * AU32_PER_GROUP;
    for (var i: u32 = tid; i < A_TILE_U32; i = i + WG_SIZE) {
      let mi: u32 = i / AU32_PER_GROUP;
      let ki: u32 = i % AU32_PER_GROUP;
      let src_m: u32 = m_block + mi;
      if (src_m < params.M) {
        a_tile[i] = a_i8[src_m * a_group_stride + g * AU32_PER_GROUP + ki];
      } else {
        a_tile[i] = 0u;
      }
    }
    workgroupBarrier();

    if (n_valid) {
      let row_base_v4: u32 = n_row * WORDS_PER_ROW_V4 + g * 2u;
      let b_quad_0: vec4<u32> = bits_buf[row_base_v4];
      let b_quad_1: vec4<u32> = bits_buf[row_base_v4 + 1u];
      let sb_idx: u32 = (n_row * NUM_GROUPS + g) * 2u;
      let scale_g: f32 = f32(scaleBias[sb_idx]);
      let bias_g: f32 = f32(scaleBias[sb_idx + 1u]);

${b(0)}
${b(1)}

${x}
    }
    workgroupBarrier();
  }

  if (n_valid) {
${S}
  }
}
`}function wn({bits:e,groupSize:t,inFeatures:n,outFeatures:r,useF16:i=!1,tileM:a=32,tileN:o=64,inputDtype:s=`float32`,outputDtype:c=`float32`,scaleBiasDtype:l=`float32`,scaleBiasLayout:u=`out-group`,assumeFullM:d=!1,assumeTernaryBias:f=!1,useARowOffset:p=!1}){if(e!==1&&e!==2&&e!==4)throw Error(`subgroup-matrix kernel currently only supports bits=1, bits=2, or bits=4`);if(f&&e!==2)throw Error(`assumeTernaryBias is only valid for 2-bit MLX weights`);if(a!==32&&a!==64)throw Error(`subgroup-matrix kernel currently supports tileM=32 or tileM=64`);if(o!==64&&o!==128)throw Error(`subgroup-matrix kernel currently supports tileN=64 or tileN=128`);if(a===64&&o!==64)throw Error(`tileM=64 currently requires tileN=64`);if(a===64&&!i)throw Error(`tileM=64 requires f16 compute to stay within workgroup storage limits`);if(o>64&&!i)throw Error(`tileN=128 requires f16 compute to stay within workgroup storage limits`);if(n%t!==0)throw Error(`inFeatures must be divisible by groupSize`);if(t%32!=0)throw Error(`groupSize must be divisible by subgroup K tile=32`);if(n%32!=0)throw Error(`inFeatures must be divisible by subgroup K tile=32`);if(r%o!==0)throw Error(`outFeatures must be divisible by subgroup N tile=${o}`);if(u!==`out-group`&&u!==`group-out`)throw Error(`unsupported scaleBiasLayout: ${u}`);let m=32/e,h=n/m,g=n/t,_=a===64?o:o/2,v=_/8,y=i?`f16`:`f32`,b=s===`float16`?`f16`:`f32`,x=l===`float16`?`f16`:`f32`,S=c===`float16`?`f16`:`f32`,C=i||s===`float16`||c===`float16`||l===`float16`?`enable f16;
`:``,w=p?`(params.aRowOffset + a_global)`:`a_global`,T=i?s===`float16`?`a[${w} * IN_FEATURES + k]`:`f16(a[${w} * IN_FEATURES + k])`:s===`float16`?`f32(a[${w} * IN_FEATURES + k])`:`a[${w} * IN_FEATURES + k]`,E=i?`0.0h`:`0.0`,D=f?i?l===`float16`?`  let scale_g: f16 = scaleBias[sb_idx];
  let bias_g: f16 = -scale_g;`:`  let scale_g: f16 = f16(scaleBias[sb_idx]);
  let bias_g: f16 = -scale_g;`:`  let scale_g: f32 = f32(scaleBias[sb_idx]);
  let bias_g: f32 = -scale_g;`:i?l===`float16`?`  let scale_g: f16 = scaleBias[sb_idx];
  let bias_g: f16 = scaleBias[sb_idx + 1u];`:`  let scale_g: f16 = f16(scaleBias[sb_idx]);
  let bias_g: f16 = f16(scaleBias[sb_idx + 1u]);`:`  let scale_g: f32 = f32(scaleBias[sb_idx]);
  let bias_g: f32 = f32(scaleBias[sb_idx + 1u]);`,O=u===`group-out`?`    let g: u32 = k_base / GROUP_SIZE;
    let sb_idx: u32 = (g * OUT_FEATURES + b_global) * 2u;`:`    let g: u32 = k_base / GROUP_SIZE;
    let sb_idx: u32 = (b_global * NUM_GROUPS + g) * 2u;`,k=`vec4<${y}>`,A=(e,t)=>`    tile_B[tile_b_base + ${t}u] = ${e}.x;
    tile_B[tile_b_base + ${t+1}u] = ${e}.y;
    tile_B[tile_b_base + ${t+2}u] = ${e}.z;
    tile_B[tile_b_base + ${t+3}u] = ${e}.w;`,j=Array.from({length:16},(e,t)=>`  {
    ${`let q: bool = ((packed >> (col + ${t}u)) & 0x1u) != 0u;`}
    tile_B[b_row * TILE_K + col + ${t}u] = select(bias_g, bias_g + scale_g, q);
  }`).join(`
`),M=Array.from({length:16},(e,t)=>{let n=t*2;return`  {
    ${i?`let q: f16 = f16((packed >> ${n}u) & 0x3u);`:`let q: f32 = f32((packed >> ${n}u) & 0x3u);`}
    tile_B[b_row * TILE_K + col + ${t}u] = scale_g * q + bias_g;
  }`}).join(`
`),N=`  let lower0: ${k} = ${k}(unpack4xU8(packed0 & 0x0F0F0F0Fu));
  let upper0: ${k} = ${k}(unpack4xU8((packed0 >> 4u) & 0x0F0F0F0Fu));
  let lower1: ${k} = ${k}(unpack4xU8(packed1 & 0x0F0F0F0Fu));
  let upper1: ${k} = ${k}(unpack4xU8((packed1 >> 4u) & 0x0F0F0F0Fu));
  let b0: ${k} = ${k}(lower0.x, upper0.x, lower0.y, upper0.y) * scale_g + ${k}(bias_g);
  let b1: ${k} = ${k}(lower0.z, upper0.z, lower0.w, upper0.w) * scale_g + ${k}(bias_g);
  let b2: ${k} = ${k}(lower1.x, upper1.x, lower1.y, upper1.y) * scale_g + ${k}(bias_g);
  let b3: ${k} = ${k}(lower1.z, upper1.z, lower1.w, upper1.w) * scale_g + ${k}(bias_g);
  let tile_b_base: u32 = b_row * TILE_K + col;
${A(`b0`,0)}
${A(`b1`,4)}
${A(`b2`,8)}
${A(`b3`,12)}`,P=e===1||e===2?`  let packed: u32 = bits_buf[b_global * WORDS_PER_ROW + k_base / VALS_PER_WORD];`:`  let word_idx: u32 = b_global * WORDS_PER_ROW + k_base / VALS_PER_WORD;
  let packed0: u32 = bits_buf[word_idx];
  let packed1: u32 = bits_buf[word_idx + 1u];`,F=e===1?j:e===2?M:N,I=e=>c===`float16`?i?e:`f16(${e})`:`f32(${e})`,ee=i&&c===`float16`||!i&&c===`float32`,L=!(ee&&d),te=d?`    tile_A[row * TILE_K + col + col_offset] = ${T};`:`    if (a_global < params.M) {
      tile_A[row * TILE_K + col + col_offset] = ${T};
    } else {
      tile_A[row * TILE_K + col + col_offset] = ${E};
    }`,R=a===64?`  let subtile_idx: u32 = 0u;
  let subtile_idy: u32 = subtile_id;`:`  let subtile_idx: u32 = subtile_id / 2u;
  let subtile_idy: u32 = subtile_id % 2u;`,ne=a===64?`    loadSHMA(a_global_base, kidx, local_idx / 4u, local_idx % 4u);
    loadSHMA(a_global_base, kidx, local_idx / 4u + 32u, local_idx % 4u);`:`    loadSHMA(a_global_base, kidx, local_idx / 4u, local_idx % 4u);`,re=Array.from({length:2},(e,t)=>Array.from({length:v},(e,n)=>`  var matC${t}${n}: subgroup_matrix_result<${y}, 8, 8>;`).join(`
`)).join(`
`),ie=Array.from({length:v},(e,t)=>`      var matB${t}: subgroup_matrix_right<${y}, 8, 8> = subgroupMatrixLoad<subgroup_matrix_right<${y}, 8, 8>>(&tile_B, matrix_b_offset + ${t*8}u * TILE_K, true, TILE_K);`).join(`
`),ae=Array.from({length:2},(e,t)=>Array.from({length:v},(e,n)=>`      matC${t}${n} = subgroupMatrixMultiplyAccumulate(matA${t}, matB${n}, matC${t}${n});`).join(`
`)).join(`
`),oe=e=>Array.from({length:v},(t,n)=>`  subgroupMatrixStore(&scratch[subtile_id][${n}], 0u, matC${e}${n}, false, 8u);`).join(`
`),se=e=>Array.from({length:v},(t,n)=>`    subgroupMatrixStore(&y, matrix_c_offset + ${e===0?``:`8u * OUT_FEATURES + `}${n*8}u, matC${e}${n}, false, OUT_FEATURES);`).join(`
`),ce=`${oe(0)}
  let row: u32 = sg_id / 4u;
  let col: u32 = (sg_id % 4u) * 2u;
${d?``:`  var row_limit: i32 = i32(params.M) - i32(a_global_base + base_A);`}
  storeOutput(matrix_c_offset, row, col, subtile_id${d?``:`, row_limit, full_m_tile`});

${oe(1)}
${d?``:`  row_limit = i32(params.M) - i32(a_global_base + base_A + 8u);`}
  storeOutput(matrix_c_offset + 8u * OUT_FEATURES, row, col, subtile_id${d?``:`, row_limit, full_m_tile`});`,le=ee?d?`${se(0)}
${se(1)}`:`  if (full_m_tile) {
${se(0)}
${se(1)}
  } else {
${ce}
  }`:ce,ue=Array.from({length:v},(e,t)=>{let n=t*8;return`    y[offset + row * OUT_FEATURES + col + ${n}u] = ${I(`scratch[src_slot][${t}][row * 8u + col]`)};
    y[offset + row * OUT_FEATURES + col + ${n+1}u] = ${I(`scratch[src_slot][${t}][row * 8u + col2]`)};`}).join(`
`);return`// Subgroup-matrix MLX matmul, bits=${e}, gs=${t}, in=${n}, out=${r}, tileM=${a}, tileN=${o}, precision=${y}, input=${s}, scaleBias=${l}/${u}, output=${c}, fullM=${d}, ternaryBias=${f}, aRowOffset=${p}.
enable subgroups;
${C}enable chromium_experimental_subgroup_matrix;
diagnostic(off, chromium.subgroup_matrix_uniformity);

struct Params { M: u32, aRowOffset: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       a:         array<${b}>;
@group(0) @binding(1) var<storage, read>       bits_buf:  array<u32>;
@group(0) @binding(2) var<storage, read>       scaleBias: array<${x}>;
@group(0) @binding(3) var<storage, read_write> y:         array<${S}>;
@group(0) @binding(4) var<uniform>             params:    Params;

const IN_FEATURES:    u32 = ${n}u;
const OUT_FEATURES:   u32 = ${r}u;
const GROUP_SIZE:     u32 = ${t}u;
const NUM_GROUPS:     u32 = ${g}u;
const VALS_PER_WORD:  u32 = ${m}u;
const WORDS_PER_ROW:  u32 = ${h}u;

const TILE_COLS:      u32 = ${o}u;
const TILE_ROWS:      u32 = ${a}u;
const TILE_K:         u32 = 32u;
const SUBTILE_COLS:   u32 = ${_}u;
const SUBTILE_ROWS:   u32 = 16u;

var<workgroup> tile_A: array<${y}, ${a} * 32>;
var<workgroup> tile_B: array<${y}, ${o} * 32>;
${L?`var<workgroup> scratch: array<array<array<${y}, 64>, ${v}>, 4>;`:``}

fn loadSHMA(tile_base: u32, k_idx: u32, row: u32, c_idx: u32) {
  let a_global: u32 = tile_base + row;
  let col: u32 = c_idx * 8u;
  for (var col_offset: u32 = 0u; col_offset < 8u; col_offset++) {
    let k: u32 = k_idx + col + col_offset;
${te}
  }
}

fn loadSHMB(tile_base: u32, k_idx: u32, row: u32, c_idx: u32) {
  let col: u32 = c_idx * 16u;
  for (var row_offset: u32 = 0u; row_offset < TILE_COLS; row_offset += 64u) {
    let b_row: u32 = row + row_offset;
    let b_global: u32 = tile_base + b_row;
    let k_base: u32 = k_idx + col;
${O}
${P}
${D}
${F}
  }
}

${L?`fn storeOutput(offset: u32, row: u32, col: u32, src_slot: u32${d?``:`, row_limit: i32, full_m_tile: bool`}) {
${d?``:`  if (full_m_tile || (row_limit > 0 && row < u32(row_limit))) {`}
    let col2: u32 = col + 1u;
${ue}
${d?``:`  }`}
}`:``}

@compute @workgroup_size(128, 1, 1)
fn main(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_index) local_idx: u32,
  @builtin(subgroup_invocation_id) sg_id: u32,
  @builtin(subgroup_size) sg_size: u32
) {
  let a_global_base: u32 = workgroup_id.y * TILE_ROWS;
  let b_global_base: u32 = workgroup_id.x * TILE_COLS;

  let subtile_id: u32 = local_idx / sg_size;
${R}
  let base_A: u32 = subtile_idy * SUBTILE_ROWS;
  let base_B: u32 = subtile_idx * SUBTILE_COLS;
${d?``:`  let full_m_tile: bool = a_global_base + TILE_ROWS <= params.M;`}

${re}

  for (var kidx: u32 = 0u; kidx < IN_FEATURES; kidx += TILE_K) {
${ne}
    loadSHMB(b_global_base, kidx, local_idx / 2u, local_idx % 2u);
    workgroupBarrier();

    for (var step: u32 = 0u; step < TILE_K; step += 8u) {
      let matrix_a_offset: u32 = subtile_idy * SUBTILE_ROWS * TILE_K + step;
      var matA0: subgroup_matrix_left<${y}, 8, 8> = subgroupMatrixLoad<subgroup_matrix_left<${y}, 8, 8>>(&tile_A, matrix_a_offset, false, TILE_K);
      var matA1: subgroup_matrix_left<${y}, 8, 8> = subgroupMatrixLoad<subgroup_matrix_left<${y}, 8, 8>>(&tile_A, matrix_a_offset + 8u * TILE_K, false, TILE_K);

      let matrix_b_offset: u32 = subtile_idx * SUBTILE_COLS * TILE_K + step;
${ie}

${ae}
    }
    workgroupBarrier();
  }

  var matrix_c_offset: u32 = (a_global_base + base_A) * OUT_FEATURES + b_global_base + base_B;
${le}
}
`}function Tn({inFeatures:e,outFeatures:t,mTile:n=88,nTile:r=16,rowPerThread:i=11,kTile:a=32,assumeFullN:o=!1}){if(e%4!=0||a%4!=0||e%a!==0)throw Error(`packed dense dual-N matmul requires K divisible by 4 and kTile`);if(t%4!=0)throw Error(`packed dense dual-N matmul requires N divisible by 4`);if(n%i!==0)throw Error(`packed dense dual-N matmul requires mTile divisible by rowPerThread`);let s=r,c=n/i,l=s*c;if(l>256)throw Error(`packed dense dual-N matmul exceeds max workgroup invocations`);let u=a/4;if((n*u+2*a*s)*8>16*1024)throw Error(`packed dense dual-N matmul exceeds 16KB workgroup storage`);let d=s*8,f=Array.from({length:i},(e,t)=>`  var acc0_${t}: vec4<f16> = vec4<f16>(0.0h);
  var acc1_${t}: vec4<f16> = vec4<f16>(0.0h);`).join(`
`),p=Array.from({length:i},(e,t)=>`        let a_vec${t} = aTile[(row_base + ${t}u) * K_TILE_V4 + kv];
        acc0_${t} = fma(b0_3, vec4<f16>(a_vec${t}.w), fma(b0_2, vec4<f16>(a_vec${t}.z), fma(b0_1, vec4<f16>(a_vec${t}.y), fma(b0_0, vec4<f16>(a_vec${t}.x), acc0_${t}))));
        acc1_${t} = fma(b1_3, vec4<f16>(a_vec${t}.w), fma(b1_2, vec4<f16>(a_vec${t}.z), fma(b1_1, vec4<f16>(a_vec${t}.y), fma(b1_0, vec4<f16>(a_vec${t}.x), acc1_${t}))));`).join(`
`),m=o?``:`n_group0 < N_V4 && `,h=o?``:`n_group1 < N_V4 && `,g=Array.from({length:i},(e,t)=>`  if (${m}m_base + ${t}u < params.M) { y[(m_base + ${t}u) * N_V4 + n_group0] = acc0_${t}; }
  if (${h}m_base + ${t}u < params.M) { y[(m_base + ${t}u) * N_V4 + n_group1] = acc1_${t}; }`).join(`
`),_=o?`      bTile0[i] = w[(k_base + kk) * N_V4 + b_group0];
      bTile1[i] = w[(k_base + kk) * N_V4 + b_group1];`:`      if (b_group0 < N_V4) {
        bTile0[i] = w[(k_base + kk) * N_V4 + b_group0];
      } else {
        bTile0[i] = vec4<f16>(0.0h);
      }
      if (b_group1 < N_V4) {
        bTile1[i] = w[(k_base + kk) * N_V4 + b_group1];
      } else {
        bTile1[i] = vec4<f16>(0.0h);
      }`;return`enable f16;
struct Params { M: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       a: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read>       w: array<vec4<f16>>;
@group(0) @binding(2) var<storage, read_write> y: array<vec4<f16>>;
@group(0) @binding(3) var<uniform>             params: Params;

const K: u32 = ${e}u;
const N: u32 = ${t}u;
const K_V4: u32 = ${e/4}u;
const N_V4: u32 = ${t/4}u;
const M_TILE: u32 = ${n}u;
const WG_X: u32 = ${s}u;
const WG_Y: u32 = ${c}u;
const ROW_PER_THREAD: u32 = ${i}u;
const OUT_TILE: u32 = ${d}u;
const K_TILE: u32 = ${a}u;
const K_TILE_V4: u32 = ${u}u;
const WG: u32 = ${l}u;

var<workgroup> aTile: array<vec4<f16>, ${n*u}>;
var<workgroup> bTile0: array<vec4<f16>, ${a*s}>;
var<workgroup> bTile1: array<vec4<f16>, ${a*s}>;

@compute @workgroup_size(${s}, ${c}, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let lx = lid.x;
  let ly = lid.y;
  let tid = ly * WG_X + lx;
  let row_base = ly * ROW_PER_THREAD;
  let m_base = wg.y * M_TILE + row_base;
  let n_group0 = wg.x * (WG_X * 2u) + lx;
  let n_group1 = n_group0 + WG_X;
${f}

  for (var k_base: u32 = 0u; k_base < K; k_base = k_base + K_TILE) {
    let k_base_v4 = k_base / 4u;
    for (var i: u32 = tid; i < ${n*u}u; i = i + WG) {
      let tm = i / K_TILE_V4;
      let kv = i - tm * K_TILE_V4;
      let gm = wg.y * M_TILE + tm;
      if (gm < params.M) {
        aTile[i] = a[gm * K_V4 + k_base_v4 + kv];
      } else {
        aTile[i] = vec4<f16>(0.0h);
      }
    }
    for (var i: u32 = tid; i < ${a*s}u; i = i + WG) {
      let kk = i / WG_X;
      let nx = i - kk * WG_X;
      let b_group0 = wg.x * (WG_X * 2u) + nx;
      let b_group1 = b_group0 + WG_X;
${_}
    }
    workgroupBarrier();

    if (m_base < params.M) {
      for (var kv: u32 = 0u; kv < K_TILE_V4; kv = kv + 1u) {
        let b0_0 = bTile0[(kv * 4u + 0u) * WG_X + lx];
        let b0_1 = bTile0[(kv * 4u + 1u) * WG_X + lx];
        let b0_2 = bTile0[(kv * 4u + 2u) * WG_X + lx];
        let b0_3 = bTile0[(kv * 4u + 3u) * WG_X + lx];
        let b1_0 = bTile1[(kv * 4u + 0u) * WG_X + lx];
        let b1_1 = bTile1[(kv * 4u + 1u) * WG_X + lx];
        let b1_2 = bTile1[(kv * 4u + 2u) * WG_X + lx];
        let b1_3 = bTile1[(kv * 4u + 3u) * WG_X + lx];
${p}
      }
    }
    workgroupBarrier();
  }

${g}
}
`}async function En(e,{aT:t,wT:n,outT:r,M:i,inFeatures:a,outFeatures:o,mTile:s=null,nTile:c=null,rowPerThread:l=null,kTile:u=null}){if(t.dtype!==`float16`||n.dtype!==`float16`||r.dtype!==`float16`)throw Error(`gpuDenseF16PackedVec4NDualNMatmul requires f16 input, weight, and output tensors`);let d=i>=128?{mTile:88,nTile:16,rowPerThread:11,kTile:32}:{mTile:32,nTile:16,rowPerThread:4,kTile:32};s??=d.mTile,c??=d.nTile,l??=d.rowPerThread,u??=d.kTile;let f=o%(c*8)==0,p=`dense_f16_packed_vec4n_dual_${a}_${o}_tm${s}_tn${c}_rpt${l}_tk${u}_fn${+!!f}`,m=Tn({inFeatures:a,outFeatures:o,mTile:s,nTile:c,rowPerThread:l,kTile:u,assumeFullN:f}),h=Qt(e,[{u32:i}],`dense-f16-packed-dual-params`);await e.runProgram({name:`dense_f16_packed_dual`,source:m,cacheKey:p,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`storage`},{buffer:h,type:`uniform`}],workgroups:[Math.ceil(o/(c*8)),Math.ceil(i/s),1]})}function Dn({inFeatures:e,innerFeatures:t,mTile:n=64,nTile:r=16,rowPerThread:i=8,kTile:a=32,assumeFullN:o=!1}){if(e%4!=0||a%4!=0||e%a!==0)throw Error(`packed dense swiglu matmul requires K divisible by 4 and kTile`);if(t%4!=0)throw Error(`packed dense swiglu matmul requires innerFeatures divisible by 4`);if(n%i!==0)throw Error(`packed dense swiglu matmul requires mTile divisible by rowPerThread`);let s=r,c=n/i,l=s*c;if(l>256)throw Error(`packed dense swiglu matmul exceeds max workgroup invocations`);let u=a/4;if((n*u+2*a*s)*8>16*1024)throw Error(`packed dense swiglu matmul exceeds 16KB workgroup storage`);let d=s*4,f=Array.from({length:i},(e,t)=>`  var accA${t}: vec4<f16> = vec4<f16>(0.0h);
  var accB${t}: vec4<f16> = vec4<f16>(0.0h);`).join(`
`),p=Array.from({length:i},(e,t)=>`        let a_vec${t} = aTile[(row_base + ${t}u) * K_TILE_V4 + kv];
        accA${t} = fma(bA3, vec4<f16>(a_vec${t}.w), fma(bA2, vec4<f16>(a_vec${t}.z), fma(bA1, vec4<f16>(a_vec${t}.y), fma(bA0, vec4<f16>(a_vec${t}.x), accA${t}))));
        accB${t} = fma(bB3, vec4<f16>(a_vec${t}.w), fma(bB2, vec4<f16>(a_vec${t}.z), fma(bB1, vec4<f16>(a_vec${t}.y), fma(bB0, vec4<f16>(a_vec${t}.x), accB${t}))));`).join(`
`),m=o?``:`n_group < INNER_V4 && `,h=Array.from({length:i},(e,t)=>`  if (${m}m_base + ${t}u < params.M) {
    let x${t} = vec4<f32>(accA${t});
    let yv${t} = vec4<f32>(accB${t});
    y[(m_base + ${t}u) * INNER_V4 + n_group] = vec4<f16>((x${t} / (vec4<f32>(1.0) + exp(-x${t}))) * yv${t});
  }`).join(`
`),g=o?``:`      if (b_group >= INNER_V4) {
        bTileA[i] = vec4<f16>(0.0h);
        bTileB[i] = vec4<f16>(0.0h);
        continue;
      }`;return`enable f16;
struct Params { M: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       a: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read>       w: array<vec4<f16>>;
@group(0) @binding(2) var<storage, read_write> y: array<vec4<f16>>;
@group(0) @binding(3) var<uniform>             params: Params;

const K: u32 = ${e}u;
const INNER: u32 = ${t}u;
const K_V4: u32 = ${e/4}u;
const INNER_V4: u32 = ${t/4}u;
const FULL_N_V4: u32 = ${t/2}u;
const M_TILE: u32 = ${n}u;
const WG_X: u32 = ${s}u;
const WG_Y: u32 = ${c}u;
const ROW_PER_THREAD: u32 = ${i}u;
const OUT_TILE: u32 = ${d}u;
const K_TILE: u32 = ${a}u;
const K_TILE_V4: u32 = ${u}u;
const WG: u32 = ${l}u;

var<workgroup> aTile: array<vec4<f16>, ${n*u}>;
var<workgroup> bTileA: array<vec4<f16>, ${a*s}>;
var<workgroup> bTileB: array<vec4<f16>, ${a*s}>;

@compute @workgroup_size(${s}, ${c}, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let lx = lid.x;
  let ly = lid.y;
  let tid = ly * WG_X + lx;
  let row_base = ly * ROW_PER_THREAD;
  let m_base = wg.y * M_TILE + row_base;
  let n_group = wg.x * WG_X + lx;
${f}

  for (var k_base: u32 = 0u; k_base < K; k_base = k_base + K_TILE) {
    let k_base_v4 = k_base / 4u;
    for (var i: u32 = tid; i < ${n*u}u; i = i + WG) {
      let tm = i / K_TILE_V4;
      let kv = i - tm * K_TILE_V4;
      let gm = wg.y * M_TILE + tm;
      if (gm < params.M) {
        aTile[i] = a[gm * K_V4 + k_base_v4 + kv];
      } else {
        aTile[i] = vec4<f16>(0.0h);
      }
    }
    for (var i: u32 = tid; i < ${a*s}u; i = i + WG) {
      let kk = i / WG_X;
      let nx = i - kk * WG_X;
      let b_group = wg.x * WG_X + nx;
${g}
      bTileA[i] = w[(k_base + kk) * FULL_N_V4 + b_group];
      bTileB[i] = w[(k_base + kk) * FULL_N_V4 + b_group + INNER_V4];
    }
    workgroupBarrier();

    if (m_base < params.M) {
      for (var kv: u32 = 0u; kv < K_TILE_V4; kv = kv + 1u) {
        let bA0 = bTileA[(kv * 4u + 0u) * WG_X + lx];
        let bA1 = bTileA[(kv * 4u + 1u) * WG_X + lx];
        let bA2 = bTileA[(kv * 4u + 2u) * WG_X + lx];
        let bA3 = bTileA[(kv * 4u + 3u) * WG_X + lx];
        let bB0 = bTileB[(kv * 4u + 0u) * WG_X + lx];
        let bB1 = bTileB[(kv * 4u + 1u) * WG_X + lx];
        let bB2 = bTileB[(kv * 4u + 2u) * WG_X + lx];
        let bB3 = bTileB[(kv * 4u + 3u) * WG_X + lx];
${p}
      }
    }
    workgroupBarrier();
  }

${h}
}
`}async function On(e,{aT:t,wT:n,outT:r,M:i,inFeatures:a,innerFeatures:o,mTile:s=null,nTile:c=null,rowPerThread:l=null,kTile:u=null}){if(t.dtype!==`float16`||n.dtype!==`float16`||r.dtype!==`float16`)throw Error(`gpuDenseF16PackedVec4NSwiGluMatmul requires f16 input, weight, and output tensors`);let d=i>=128?{mTile:88,nTile:16,rowPerThread:11,kTile:32}:{mTile:32,nTile:16,rowPerThread:4,kTile:32};s??=d.mTile,c??=d.nTile,l??=d.rowPerThread,u??=d.kTile;let f=o%(c*4)==0,p=`dense_f16_packed_swiglu_${a}_${o}_tm${s}_tn${c}_rpt${l}_tk${u}_fn${+!!f}`,m=Dn({inFeatures:a,innerFeatures:o,mTile:s,nTile:c,rowPerThread:l,kTile:u,assumeFullN:f}),h=Qt(e,[{u32:i}],`dense-f16-packed-swiglu-params`);await e.runProgram({name:`dense_f16_packed_swiglu`,source:m,cacheKey:p,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`storage`},{buffer:h,type:`uniform`}],workgroups:[Math.ceil(o/(c*4)),Math.ceil(i/s),1]})}function kn(e){return e===`float16`?`f16`:`f32`}function An(...e){return e.includes(`float16`)?`enable f16;
`:``}function jn(e,t){return t===`float16`?`f32(${e})`:e}function Mn(e,t){return t===`float16`?`f16(${e})`:e}async function Nn(e,{xT:t,wT:n,yT:r,rows:i,dim:a,eps:o=1e-6}){let s=t.dtype,c=n?.dtype??`float32`,l=r.dtype,u=`rmsnorm_d${a}_e${o}_${n?`w`:`nw`}_${s}_${c}_${l}`,d=an({dim:a,eps:o,withWeight:!!n,inputDtype:s,weightDtype:c,outputDtype:l}),f=Math.min(i,65535),p=Math.ceil(i/f),m=Qt(e,[{u32:i},{u32:f}],`rmsnorm-params`),h=[{tensor:t,type:`read-only-storage`},...n?[{tensor:n,type:`read-only-storage`}]:[],{tensor:r,type:`storage`},{buffer:m,type:`uniform`}];await e.runProgram({name:`rmsnorm`,source:d,cacheKey:u,bindings:h,workgroups:[f,p,1]})}async function Pn(e,{xT:t,cosT:n,sinT:r,seq:i,heads:a,headDim:o}){let s=t.dtype,c=`rope1d_hd${o}_${s}`,l=on({headDim:o,activationDtype:s}),u=Qt(e,[{u32:i},{u32:a}],`rope-params`);await e.runProgram({name:`rope1d`,source:l,cacheKey:c,bindings:[{tensor:t,type:`storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{buffer:u,type:`uniform`}],workgroups:[i,a,1]})}async function Fn(e,{xT:t,count:n}){let r=t.dtype,i=`silu_2d_${r}`,a=sn({dtype:r}),{wgX:o,wgY:s}=cn(n),c=Qt(e,[{u32:n},{u32:s}],`silu-params`);await e.runProgram({name:`silu`,source:a,cacheKey:i,bindings:[{tensor:t,type:`storage`},{buffer:c,type:`uniform`}],workgroups:[s,o,1]})}async function In(e,{xT:t,yT:n,rows:r,mlpInner:i}){let a=t.dtype,o=n.dtype,s=a===`float16`&&o===`float16`&&i%4==0,c=`swiglu_m${i}_${a}_${o}${s?`_v4`:``}`,l=ln({mlpInner:i,inputDtype:a,outputDtype:o}),u=Qt(e,[{u32:r}],`swiglu-params`);await e.runProgram({name:`swiglu`,source:l,cacheKey:c,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`storage`},{buffer:u,type:`uniform`}],workgroups:[r,Math.ceil((s?i/4:i)/64),1]})}async function Ln(e,{xT:t,yT:n,count:r,alpha:i}){let a=t.dtype,o=n.dtype,s=`axpy_2d_${a}_${o}`,c=un({xDtype:a,yDtype:o}),{wgX:l,wgY:u}=cn(r),d=Qt(e,[{u32:r},{f32:i},{u32:u}],`axpy-params`);await e.runProgram({name:`axpy`,source:c,cacheKey:s,bindings:[{tensor:t,type:`storage`},{tensor:n,type:`read-only-storage`},{buffer:d,type:`uniform`}],workgroups:[u,l,1]})}async function Rn(e,{packedT:t,meanT:n,stdT:r,outT:i=null,outputDtype:a=`float32`,latentC:o,latentH:s,latentW:c}){let l=s/2,u=c/2;if(!Number.isInteger(l)||!Number.isInteger(u))throw Error(`latentH and latentW must be divisible by 2`);let d=o*4,f=o*s*c,p=i?.dtype??a,m=kn(p),h=i??e.empty(p,[o,s,c],`flux-vae-latents`),g=`flux_pack_to_vae_lc${o}_h${s}_w${c}_${p}`,_=`${An(p)}struct Params { count: u32, wgY: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       packed: array<f32>;
@group(0) @binding(1) var<storage, read>       mean: array<f32>;
@group(0) @binding(2) var<storage, read>       bnStd: array<f32>;
@group(0) @binding(3) var<storage, read_write> out: array<${m}>;
@group(0) @binding(4) var<uniform>             params: Params;

const LATENT_C: u32 = ${o}u;
const LATENT_H: u32 = ${s}u;
const LATENT_W: u32 = ${c}u;
const PATCH_W:  u32 = ${u}u;
const PATCHED_C: u32 = ${d}u;
const HW: u32 = ${s*c}u;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let i = wg_idx * 64u + lid.x;
  if (i >= params.count) { return; }

  let c = i / HW;
  let rem = i - c * HW;
  let y = rem / LATENT_W;
  let x = rem - y * LATENT_W;
  let py = y & 1u;
  let px = x & 1u;
  let in_chan = c * 4u + py * 2u + px;
  let seq = (y / 2u) * PATCH_W + (x / 2u);
  let v = packed[seq * PATCHED_C + in_chan];
  out[i] = ${Mn(`v * bnStd[in_chan] + mean[in_chan]`,p)};
}
`,{wgX:v,wgY:y}=cn(f),b=Qt(e,[{u32:f},{u32:y}],`flux-vae-latents-params`);return await e.runProgram({name:`flux_pack_to_vae`,source:_,cacheKey:g,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:h,type:`storage`},{buffer:b,type:`uniform`}],workgroups:[y,v,1]}),h}function zn({inputDtype:e=`float32`,outputDtype:t=`float16`}){let n=kn(e),r=kn(t);return`${An(e,t)}struct Params { count: u32, wgY: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       x: array<${n}>;
@group(0) @binding(1) var<storage, read_write> y: array<${r}>;
@group(0) @binding(2) var<uniform>             params: Params;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let i = wg_idx * 64u + lid.x;
  if (i >= params.count) { return; }
  y[i] = ${Mn(jn(`x[i]`,e),t)};
}
`}async function Bn(e,{xT:t,yT:n,count:r}){let i=t.dtype,a=n.dtype,o=`cast_${i}_${a}`,s=zn({inputDtype:i,outputDtype:a}),{wgX:c,wgY:l}=cn(r),u=Qt(e,[{u32:r},{u32:l}],`cast-params`);await e.runProgram({name:`cast`,source:s,cacheKey:o,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`storage`},{buffer:u,type:`uniform`}],workgroups:[l,c,1]})}function Vn({dtype:e=`float16`}){let t=kn(e);return`${An(e)}struct Params { rows: u32, cols: u32, scale: f32, _pad0: u32 };
@group(0) @binding(0) var<storage, read_write> x: array<${t}>;
@group(0) @binding(1) var<uniform>             params: Params;

const WG: u32 = 256u;
var<workgroup> partial: array<f32, 256>;

fn reduce_max(v: f32, tid: u32) -> f32 {
  partial[tid] = v;
  workgroupBarrier();
  var stride: u32 = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      partial[tid] = max(partial[tid], partial[tid + stride]);
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return partial[0];
}

fn reduce_sum(v: f32, tid: u32) -> f32 {
  partial[tid] = v;
  workgroupBarrier();
  var stride: u32 = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      partial[tid] = partial[tid] + partial[tid + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return partial[0];
}

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let row = wg.x;
  if (row >= params.rows) { return; }
  let tid = lid.x;
  let base = row * params.cols;
  var local_max = -3.4e38;
  for (var c: u32 = tid; c < params.cols; c = c + WG) {
    local_max = max(local_max, ${jn(`x[base + c]`,e)} * params.scale);
  }
  let row_max = reduce_max(local_max, tid);

  var local_sum = 0.0;
  for (var c: u32 = tid; c < params.cols; c = c + WG) {
    local_sum = local_sum + exp(${jn(`x[base + c]`,e)} * params.scale - row_max);
  }
  let inv_sum = 1.0 / reduce_sum(local_sum, tid);

  for (var c: u32 = tid; c < params.cols; c = c + WG) {
    let p = exp(${jn(`x[base + c]`,e)} * params.scale - row_max) * inv_sum;
    x[base + c] = ${Mn(`p`,e)};
  }
}
`}async function Hn(e,{xT:t,rows:n,cols:r,scale:i=1}){let a=t.dtype,o=`row_softmax_inplace_${a}`,s=Vn({dtype:a}),c=Qt(e,[{u32:n},{u32:r},{f32:i}],`row-softmax-params`);await e.runProgram({name:`row_softmax`,source:s,cacheKey:o,bindings:[{tensor:t,type:`storage`},{buffer:c,type:`uniform`}],workgroups:[n,1,1]})}async function Un(e,{xT:t,factorT:n,count:r,period:i=0}){let a=t.dtype,o=n.dtype,s=`mulbcast_2d_${a}_${o}`,c=dn({xDtype:a,factorDtype:o}),{wgX:l,wgY:u}=cn(r),d=Qt(e,[{u32:r},{u32:i},{u32:u}],`mulbcast-params`);await e.runProgram({name:`mulbcast`,source:c,cacheKey:s,bindings:[{tensor:t,type:`storage`},{tensor:n,type:`read-only-storage`},{buffer:d,type:`uniform`}],workgroups:[u,l,1]})}async function Wn(e,{qT:t,kT:n,vT:r,outT:i,seq:a,qHeads:o,kvHeads:s,headDim:c,causal:l}){let u=t.dtype,d=i.dtype;if(!l&&a>=8){let l=!!e.caps().subgroups,f=l&&u===`float16`&&d===`float16`&&c===128?32:u===`float16`&&d===`float16`&&c===512?4:u===`float16`&&d===`float16`&&c<=512||!l&&u===`float32`&&d===`float32`&&c===128?2:1,p=Number({}.BONSAI_FLASH_Q32_KSTEP??64)===64?64:32,m=f===32?p:32,h=f>1&&u===`float16`,g=`bonsai_flash_attn_q${f}_hd${c}_kt${m}_${u}_${d}_${l?`sg`:`nosg`}_${h?`qkh`:`qkf`}`,_=f===32?gn({headDim:c,kStep:m,inputDtype:u,outputDtype:d}):f===4?hn({headDim:c,kTile:m,inputDtype:u,outputDtype:d,useSubgroups:l,useHalfQk:h}):f===2?mn({headDim:c,kTile:m,inputDtype:u,outputDtype:d,useSubgroups:l,useHalfQk:h}):pn({headDim:c,kTile:m,inputDtype:u,outputDtype:d,useSubgroups:l}),v=Qt(e,[{u32:a},{u32:o},{u32:s},{u32:0}],`flash-attn-params`);await e.runProgram({name:`flash_attention`,source:_,cacheKey:g,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:i,type:`storage`},{buffer:v,type:`uniform`}],workgroups:[Math.ceil(a/f),o,1]});return}let f=`bonsai_attn_hd${c}_${u}_${d}`,p=fn({headDim:c,inputDtype:u,outputDtype:d}),m=Qt(e,[{u32:a},{u32:o},{u32:s},{u32:+!!l}],`attn-params`);await e.runProgram({name:`attention`,source:p,cacheKey:f,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:i,type:`storage`},{buffer:m,type:`uniform`}],workgroups:[a,o,1]})}async function Gn(e,{aT:t,bT:n,outT:r,aElems:i,totalElems:a}){let o=r.dtype,s=`concat_${o}`,c=_n({dtype:o}),{wgX:l,wgY:u}=cn(a),d=Qt(e,[{u32:a},{u32:i},{u32:u}],`concat-params`);await e.runProgram({name:`concat`,source:c,cacheKey:s,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`storage`},{buffer:d,type:`uniform`}],workgroups:[u,l,1]})}function Kn(e,{M:t,inFeatures:n,groupSize:r}){let i=n/r;return{aQT:e.empty(`uint32`,[t,n/4],`a-quantized`),scaleAT:e.empty(`float32`,[t,i],`a-scale`),sumAT:e.empty(`float32`,[t,i],`a-sum`)}}async function qn(e,{aT:t,aQT:n,scaleAT:r,sumAT:i,M:a,inFeatures:o,groupSize:s}){let c=t.dtype,l=`quantize_a_i8_${c}_g${s}_k${o}`,u=xn({inFeatures:o,groupSize:s,inputDtype:c}),d=Qt(e,[{u32:a}],`quantizeA-params`),f=o/s;await e.runProgram({name:`quantize_a_i8`,source:u,cacheKey:l,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`storage`},{tensor:r,type:`storage`},{tensor:i,type:`storage`},{buffer:d,type:`uniform`}],workgroups:[f,a,1]})}async function Jn(e,{aQT:t,scaleAT:n,sumAT:r,bitsT:i,sbT:a,outT:o,M:s,inFeatures:c,outFeatures:l,bits:u,groupSize:d}){if(s<2)throw Error(`gpuMlxMatmulDP4A requires M >= 2`);if(u!==2||d!==128)throw Error(`DP4A path requires bits=2, groupSize=128`);let f=64;for(let e of[128,64,32])if(l%e===0){f=e;break}let p=c<=9216?3:2;s<p&&(p=1);let m=o.dtype,h=a.dtype,g=`mlxmatmul_dp4a_${m}_${h}_b${u}_g${d}_i${c}_o${l}_tm${p}_tn${f}`,_=Cn({bits:u,groupSize:d,inFeatures:c,outFeatures:l,tileM:p,tileN:f,outputDtype:m,scaleBiasDtype:h}),v=Qt(e,[{u32:s}],`mlxmatmul-dp4a-params`),y=Math.ceil(l/f),b=Math.ceil(s/p);await e.runProgram({name:`mlx_matmul`,source:_,cacheKey:g,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:i,type:`read-only-storage`},{tensor:a,type:`read-only-storage`},{tensor:o,type:`storage`},{buffer:v,type:`uniform`}],workgroups:[y,b,1]})}async function Yn(e,{bitsT:t,sbT:n,outT:r,inFeatures:i,outFeatures:a,bits:o,groupSize:s,outputLayout:c=`out-k`}){if(r.dtype!==`float16`)throw Error(`gpuMlxDequantizeToF16 requires a float16 output tensor`);let l=n.scaleBiasDtype??n.dtype,u=n.scaleBiasLayout??`out-group`,d=!!n.ternaryBiasFromScale,f=`mlx_dequant_f16_${l}_${u}_${c}_b${o}_g${s}_i${i}_o${a}_tb${+!!d}`,p=Sn({bits:o,groupSize:s,inFeatures:i,outFeatures:a,scaleBiasDtype:l,scaleBiasLayout:u,outputLayout:c,assumeTernaryBias:d}),m=a*(i/(32/o)),{wgX:h,wgY:g}=cn(m),_=Qt(e,[{u32:m},{u32:g}],`mlx-dequant-f16-params`);await e.runProgram({name:`mlx_dequant_f16`,source:p,cacheKey:f,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`storage`},{buffer:_,type:`uniform`}],workgroups:[g,h,1]})}async function Xn(e,{aT:t,bitsT:n,sbT:r,outT:i,M:a,inFeatures:o,outFeatures:s,bits:c,groupSize:l,useF16:u=!1,assumeTernaryBias:d=!1,aRowOffset:f=0,scaleBiasLayout:p=`out-group`,tileM:m=32,tileN:h=null}){if(!e.caps().subgroupMatrix)throw Error(`gpuMlxMatmulSubgroupMatrix requires chromium-experimental-subgroup-matrix`);if(!(c===1&&l===128||c===2&&l===128||c===4&&l===64))throw Error(`subgroup-matrix path requires bits=1/groupSize=128, bits=2/groupSize=128, or bits=4/groupSize=64`);if(s%64!=0)throw Error(`subgroup-matrix path requires outFeatures divisible by 64`);if(o%32!=0)throw Error(`subgroup-matrix path requires inFeatures divisible by 32`);let g=m,_=u&&g===32&&s%128==0&&(a>=g||o===3072&&s>=18432),v=h??(_?128:64),y=t.dtype,b=r.dtype,x=i.dtype,S=u?`f16`:`f32`,C=a%g===0,w=f!==0,T=`mlxmatmul_sgmat_${S}_${y}_${b}_${x}_${p===`group-out`?`go`:`og`}_b${c}_g${l}_i${o}_o${s}_tm${g}_tn${v}_fm${+!!C}_tb${+!!d}_ao${+!!w}`,E=wn({bits:c,groupSize:l,inFeatures:o,outFeatures:s,useF16:u,tileM:g,tileN:v,inputDtype:y,scaleBiasDtype:b,outputDtype:x,scaleBiasLayout:p,assumeFullM:C,assumeTernaryBias:d,useARowOffset:w}),D=Qt(e,[{u32:a},{u32:f}],`mlxmatmul-sgmat-params`);await e.runProgram({name:`mlx_matmul`,source:E,cacheKey:T,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:i,type:`storage`},{buffer:D,type:`uniform`}],workgroups:[Math.ceil(s/v),Math.ceil(a/g),1]})}async function Zn(e,{aT:t,bitsT:n,sbT:r,outT:i,M:a,inFeatures:o,outFeatures:s,tileM:c=null,tileN:l=256,nPerThread:u=null,assumeBiasNegHalfScale:d=!1,scaleOnly:f=!1}){if(t.dtype!==`float16`||r.dtype!==`float16`||i.dtype!==`float16`)throw Error(`gpuMlxMatmulBinaryLut4 requires f16 A, scaleBias, and output tensors`);if(o%128!=0)throw Error(`gpuMlxMatmulBinaryLut4 requires K divisible by 128`);c??=a<128?a>=8?10:Math.max(1,a):d?s===3072&&o===3072?10:s>=27648?14:16:s===3072&&o===3072?6:s===3072&&o>=9216?15:13,u??(d&&a>=128&&o===3072&&s>=9216?(u=2,l===256&&(l=512)):u=1);let p=!!(f&&d),m=`mlxmatmul_binary_lut4_${o}_${s}_tm${c}_tn${l}_npt${u}_nh${+!!d}_so${+!!p}`,h=bn({inFeatures:o,outFeatures:s,tileM:c,tileN:l,nPerThread:u,assumeBiasNegHalfScale:d,scaleOnly:p}),g=Qt(e,[{u32:a}],`mlxmatmul-binary-lut4-params`);await e.runProgram({name:`mlx_matmul_binary_lut4`,source:h,cacheKey:m,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:i,type:`storage`},{buffer:g,type:`uniform`}],workgroups:[Math.ceil(s/l),Math.ceil(a/c),1]})}async function Qn(e,{aT:t,bitsT:n,sbT:r,outT:i,M:a,inFeatures:o,outFeatures:s,bits:c,groupSize:l}){let u=t.dtype,d=r.dtype,f=i.dtype;if(a>=16&&e.caps().subgroupMatrix&&e.caps().f16&&u===`float16`&&f===`float16`&&(c===1&&l===128||c===2&&l===128||c===4&&l===64)&&o%32==0&&s%64==0){await Xn(e,{aT:t,bitsT:n,sbT:r,outT:i,M:a,inFeatures:o,outFeatures:s,bits:c,groupSize:l,useF16:!0,assumeTernaryBias:c===2});return}let p,m;if(a===1?u===`float32`&&d===`float32`&&f===`float32`?p=0:s%64==0?(p=1,m=64):s%32==0?(p=1,m=32):s%16==0?(p=1,m=16):p=0:s%64==0?(p=a>=4?4:a>=2?2:1,m=64):s%32==0?(p=a>=8?8:a>=4?4:a>=2?2:1,m=32):s%16==0?(p=a>=16?16:a>=8?8:4,m=16):p=0,p===0){if(t.dtype!==`float32`||r.dtype!==`float32`||i.dtype!==`float32`)throw Error(`MLX matmul fallback path only supports float32 tensors`);let u=`mlxmatmul_b${c}_g${l}_i${o}_o${s}`,d=vn({bits:c,groupSize:l,inFeatures:o,outFeatures:s}),f=Qt(e,[{u32:a}],`mlxmatmul-params`);await e.runProgram({name:`mlx_matmul`,source:d,cacheKey:u,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:i,type:`storage`},{buffer:f,type:`uniform`}],workgroups:[s,a,1]});return}let h=o/l,g=1;for(let e of[4,2])if(h%e===0&&p*e*l*4<=8192){g=e;break}let _=1;for(let e of[4,2])if(s%(m*e)===0){_=e;break}let v=m*_,y=`mlxmatmul_tiled_${u}_${d}_${f}_b${c}_g${l}_i${o}_o${s}_m${p}_n${m}_kgc${g}_npt${_}`,b=yn({bits:c,groupSize:l,inFeatures:o,outFeatures:s,mTile:p,outTile:m,kGroupsPerChunk:g,nPerThread:_,inputDtype:u,outputDtype:f,scaleBiasDtype:d}),x=Qt(e,[{u32:a}],`mlxmatmul-params`),S=Math.ceil(s/v),C=Math.ceil(a/p);await e.runProgram({name:`mlx_matmul`,source:b,cacheKey:y,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:i,type:`storage`},{buffer:x,type:`uniform`}],workgroups:[S,C,1]})}async function $n(e,{aT:t,bitsT:n,sbT:r,outT:i,M:a,inFeatures:o,outFeatures:s,bits:c,groupSize:l}){let u=t.dtype,d=r.dtype,f=i.dtype;if(a>=16&&e.caps().subgroupMatrix&&e.caps().f16&&u===`float16`&&f===`float16`&&c===4&&l===64&&o%32==0&&s%64==0){await Xn(e,{aT:t,bitsT:n,sbT:r,outT:i,M:a,inFeatures:o,outFeatures:s,bits:c,groupSize:l,useF16:!0,assumeTernaryBias:!1});return}let p,m;if(s%64==0)p=a>=4?4:a>=2?2:1,m=64;else if(s%32==0)p=a>=8?8:a>=4?4:a>=2?2:1,m=32;else if(s%16==0)p=a>=16?16:a>=8?8:a>=4?4:1,m=16;else throw Error(`Bonsai text MLX matmul requires outFeatures divisible by 16`);let h=o/l,g=1;for(let e of[4,2])if(h%e===0&&p*e*l*4<=8192){g=e;break}let _=1;for(let e of[4,2])if(s%(m*e)===0){_=e;break}let v=m*_,y=`bonsai_mlxmatmul_tiled_${u}_${d}_${f}_b${c}_g${l}_i${o}_o${s}_m${p}_n${m}_kgc${g}_npt${_}`,b=yn({bits:c,groupSize:l,inFeatures:o,outFeatures:s,mTile:p,outTile:m,kGroupsPerChunk:g,nPerThread:_,inputDtype:u,outputDtype:f,scaleBiasDtype:d}),x=Qt(e,[{u32:a}],`mlxmatmul-params`);await e.runProgram({name:`mlx_matmul`,source:b,cacheKey:y,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:i,type:`storage`},{buffer:x,type:`uniform`}],workgroups:[Math.ceil(s/v),Math.ceil(a/p),1]})}function er({inFeatures:e,outFeatures:t,hasBias:n,inputDtype:r=`float32`,weightDtype:i=`float32`,biasDtype:a=`float32`,outputDtype:o=`float32`}){let s=kn(r),c=kn(i),l=kn(a),u=kn(o);return`${An(r,i,a,o)}struct Params { M: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       x: array<${s}>;
@group(0) @binding(1) var<storage, read>       w: array<${c}>;
${n?`@group(0) @binding(2) var<storage, read>       b: array<${l}>;
`:``}@group(0) @binding(${n?3:2}) var<storage, read_write> y: array<${u}>;
@group(0) @binding(${n?4:3}) var<uniform>             params: Params;

const IN_F: u32 = ${e}u;
const OUT_F: u32 = ${t}u;
const WG: u32 = 64u;

var<workgroup> partial: array<f32, WG>;

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let n = wg.x;
  let m = wg.y;
  if (n >= OUT_F || m >= params.M) { return; }
  let tid = lid.x;
  let wBase = n * IN_F;
  let xBase = m * IN_F;

  var acc: f32 = 0.0;
  for (var i: u32 = tid; i < IN_F; i = i + WG) {
    acc = acc + ${jn(`x[xBase + i]`,r)} * ${jn(`w[wBase + i]`,i)};
  }
  partial[tid] = acc;
  workgroupBarrier();
  var stride: u32 = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) { partial[tid] = partial[tid] + partial[tid + stride]; }
    stride = stride / 2u;
    workgroupBarrier();
  }
  if (tid == 0u) {
    ${n?`y[m * OUT_F + n] = ${Mn(`partial[0] + ${jn(`b[n]`,a)}`,o)};`:`y[m * OUT_F + n] = ${Mn(`partial[0]`,o)};`}
  }
}
`}function tr({inFeatures:e,outFeatures:t,outputDtype:n=`float16`,mTile:r=16,nTile:i=8,nPerThread:a=8,kTile:o=64}){if(e%4!=0||o%4!=0)throw Error(`dense f16 tiled matmul requires K and kTile divisible by 4`);if(r*i>256)throw Error(`dense f16 tiled matmul tile exceeds max workgroup invocations`);if(n!==`float16`&&n!==`float32`)throw Error(`dense f16 tiled matmul output must be f16/f32`);let s=r*i,c=o/4,l=i*a;if((r*c+l*c)*8>16*1024)throw Error(`dense f16 tiled matmul exceeds 16KB workgroup storage`);let u=kn(n),d=Array.from({length:a},(e,t)=>`  var acc${t}: f32 = 0.0;`).join(`
`),f=Array.from({length:a},(e,t)=>`        let b_idx${t} = (n_local + ${t*i}u) * K_TILE_V4 + kv;
        acc${t} = acc${t} + dot(vec4<f32>(a_vec), vec4<f32>(bTile[b_idx${t}]));`).join(`
`),p=Array.from({length:a},(e,t)=>{let r=`n0 + ${t*i}u`;return`    if (${r} < N) { y[m * N + ${r}] = ${Mn(`acc${t}`,n)}; }`}).join(`
`);return`enable f16;
struct Params { M: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       a: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read>       w: array<vec4<f16>>;
@group(0) @binding(2) var<storage, read_write> y: array<${u}>;
@group(0) @binding(3) var<uniform>             params: Params;

const K: u32 = ${e}u;
const N: u32 = ${t}u;
const K_V4: u32 = ${e/4}u;
const M_TILE: u32 = ${r}u;
const N_TILE: u32 = ${i}u;
const OUT_TILE: u32 = ${l}u;
const K_TILE: u32 = ${o}u;
const K_TILE_V4: u32 = ${c}u;
const WG: u32 = ${s}u;

var<workgroup> aTile: array<vec4<f16>, ${r*c}>;
var<workgroup> bTile: array<vec4<f16>, ${l*c}>;

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let tid = lid.x;
  let m_local = tid / N_TILE;
  let n_local = tid - m_local * N_TILE;
  let m = wg.y * M_TILE + m_local;
  let n0 = wg.x * OUT_TILE + n_local;
${d}

  for (var k_base: u32 = 0u; k_base < K; k_base = k_base + K_TILE) {
    let k_base_v4 = k_base / 4u;
    for (var i: u32 = tid; i < ${r*c}u; i = i + WG) {
      let tm = i / K_TILE_V4;
      let kv = i - tm * K_TILE_V4;
      let gm = wg.y * M_TILE + tm;
      if (gm < params.M) {
        aTile[i] = a[gm * K_V4 + k_base_v4 + kv];
      } else {
        aTile[i] = vec4<f16>(0.0h);
      }
    }
    for (var i: u32 = tid; i < ${l*c}u; i = i + WG) {
      let tn = i / K_TILE_V4;
      let kv = i - tn * K_TILE_V4;
      let gn = wg.x * OUT_TILE + tn;
      if (gn < N) {
        bTile[i] = w[gn * K_V4 + k_base_v4 + kv];
      } else {
        bTile[i] = vec4<f16>(0.0h);
      }
    }
    workgroupBarrier();

    if (m < params.M) {
      for (var kv: u32 = 0u; kv < K_TILE_V4; kv = kv + 1u) {
        let a_idx = m_local * K_TILE_V4 + kv;
        let a_vec = aTile[a_idx];
${f}
      }
    }
    workgroupBarrier();
  }

  if (m < params.M) {
${p}
  }
}
`}async function nr(e,{aT:t,wT:n,outT:r,M:i,inFeatures:a,outFeatures:o}){if(t.dtype!==`float16`||n.dtype!==`float16`)throw Error(`gpuDenseF16TiledMatmul requires f16 input and weight tensors`);let s=r.dtype,c=`dense_f16_tiled_${a}_${o}_${s}_tm32_tn4_npt16_tk64`,l=tr({inFeatures:a,outFeatures:o,outputDtype:s,mTile:32,nTile:4,nPerThread:16,kTile:64}),u=Qt(e,[{u32:i}],`dense-f16-tiled-params`);await e.runProgram({name:`dense_f16_tiled`,source:l,cacheKey:c,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`storage`},{buffer:u,type:`uniform`}],workgroups:[Math.ceil(o/64),Math.ceil(i/32),1]})}function rr({inFeatures:e,outFeatures:t,mTile:n=32,nTile:r=16,rowPerThread:i=4,kTile:a=64,accumDtype:o=`float16`,assumeFullN:s=!1}){if(e%4!=0||a%4!=0||e%a!==0)throw Error(`packed dense f16 matmul requires K divisible by 4 and kTile`);if(t%4!=0)throw Error(`packed dense f16 matmul requires N divisible by 4`);if(n%i!==0)throw Error(`packed dense f16 matmul requires mTile divisible by rowPerThread`);let c=r,l=n/i,u=c*l;if(u>256)throw Error(`packed dense f16 matmul exceeds max workgroup invocations`);let d=a/4;if((n*d+a*c)*8>16*1024)throw Error(`packed dense f16 matmul exceeds 16KB workgroup storage`);let f=c*4;if(o!==`float16`&&o!==`float32`)throw Error(`packed dense f16 matmul accumulation must be f16 or f32`);let p=o===`float32`,m=p?`f32`:`f16`,h=p?`vec4<f32>(0.0)`:`vec4<f16>(0.0h)`,g=Array.from({length:i},(e,t)=>`  var acc${t}: vec4<${m}> = ${h};`).join(`
`),_=Array.from({length:i},(e,t)=>p?`        let a_vec${t} = aTile[(row_base + ${t}u) * K_TILE_V4 + kv];
        acc${t} = fma(vec4<f32>(b3), vec4<f32>(f32(a_vec${t}.w)), fma(vec4<f32>(b2), vec4<f32>(f32(a_vec${t}.z)), fma(vec4<f32>(b1), vec4<f32>(f32(a_vec${t}.y)), fma(vec4<f32>(b0), vec4<f32>(f32(a_vec${t}.x)), acc${t}))));`:`        let a_vec${t} = aTile[(row_base + ${t}u) * K_TILE_V4 + kv];
        acc${t} = fma(b3, vec4<f16>(a_vec${t}.w), fma(b2, vec4<f16>(a_vec${t}.z), fma(b1, vec4<f16>(a_vec${t}.y), fma(b0, vec4<f16>(a_vec${t}.x), acc${t}))));`).join(`
`),v=s?``:`n_group < N_V4 && `,y=Array.from({length:i},(e,t)=>`  if (${v}m_base + ${t}u < params.M) { y[(m_base + ${t}u) * N_V4 + n_group] = ${p?`vec4<f16>(acc${t})`:`acc${t}`}; }`).join(`
`),b=s?`      bTile[i] = w[(k_base + kk) * N_V4 + b_group];`:`      if (b_group < N_V4) {
        bTile[i] = w[(k_base + kk) * N_V4 + b_group];
      } else {
        bTile[i] = vec4<f16>(0.0h);
      }`;return`enable f16;
struct Params { M: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       a: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read>       w: array<vec4<f16>>;
@group(0) @binding(2) var<storage, read_write> y: array<vec4<f16>>;
@group(0) @binding(3) var<uniform>             params: Params;

const K: u32 = ${e}u;
const N: u32 = ${t}u;
const K_V4: u32 = ${e/4}u;
const N_V4: u32 = ${t/4}u;
const M_TILE: u32 = ${n}u;
const WG_X: u32 = ${c}u;
const WG_Y: u32 = ${l}u;
const ROW_PER_THREAD: u32 = ${i}u;
const OUT_TILE: u32 = ${f}u;
const K_TILE: u32 = ${a}u;
const K_TILE_V4: u32 = ${d}u;
const WG: u32 = ${u}u;

var<workgroup> aTile: array<vec4<f16>, ${n*d}>;
var<workgroup> bTile: array<vec4<f16>, ${a*c}>;

@compute @workgroup_size(${c}, ${l}, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let lx = lid.x;
  let ly = lid.y;
  let tid = ly * WG_X + lx;
  let row_base = ly * ROW_PER_THREAD;
  let m_base = wg.y * M_TILE + row_base;
  let n_group = wg.x * WG_X + lx;
${g}

  for (var k_base: u32 = 0u; k_base < K; k_base = k_base + K_TILE) {
    let k_base_v4 = k_base / 4u;
    for (var i: u32 = tid; i < ${n*d}u; i = i + WG) {
      let tm = i / K_TILE_V4;
      let kv = i - tm * K_TILE_V4;
      let gm = wg.y * M_TILE + tm;
      if (gm < params.M) {
        aTile[i] = a[gm * K_V4 + k_base_v4 + kv];
      } else {
        aTile[i] = vec4<f16>(0.0h);
      }
    }
    for (var i: u32 = tid; i < ${a*c}u; i = i + WG) {
      let kk = i / WG_X;
      let nx = i - kk * WG_X;
      let b_group = wg.x * WG_X + nx;
${b}
    }
    workgroupBarrier();

    if (m_base < params.M) {
      for (var kv: u32 = 0u; kv < K_TILE_V4; kv = kv + 1u) {
        let b0 = bTile[(kv * 4u + 0u) * WG_X + lx];
        let b1 = bTile[(kv * 4u + 1u) * WG_X + lx];
        let b2 = bTile[(kv * 4u + 2u) * WG_X + lx];
        let b3 = bTile[(kv * 4u + 3u) * WG_X + lx];
${_}
      }
    }
    workgroupBarrier();
  }

${y}
}
`}async function ir(e,{aT:t,wT:n,outT:r,M:i,inFeatures:a,outFeatures:o,mTile:s=null,nTile:c=null,rowPerThread:l=null,kTile:u=null,accumDtype:d=null}){if(t.dtype!==`float16`||n.dtype!==`float16`||r.dtype!==`float16`)throw Error(`gpuDenseF16PackedVec4NMatmul requires f16 input, weight, and output tensors`);let f=i>=128?{mTile:88,nTile:16,rowPerThread:11,kTile:32,accumDtype:`float16`}:{mTile:32,nTile:16,rowPerThread:4,kTile:64,accumDtype:`float16`};s??=f.mTile,c??=f.nTile,l??=f.rowPerThread,u??=f.kTile,d??=f.accumDtype;let p=o%(c*4)==0,m=`dense_f16_packed_vec4n_${d}_${a}_${o}_tm${s}_tn${c}_rpt${l}_tk${u}_fn${+!!p}`,h=rr({inFeatures:a,outFeatures:o,mTile:s,nTile:c,rowPerThread:l,kTile:u,accumDtype:d,assumeFullN:p}),g=Qt(e,[{u32:i}],`dense-f16-packed-params`);await e.runProgram({name:`dense_f16_packed`,source:h,cacheKey:m,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`storage`},{buffer:g,type:`uniform`}],workgroups:[Math.ceil(o/(c*4)),Math.ceil(i/s),1]})}function ar({inFeatures:e,outFeatures:t,inputDtype:n=`float32`,weightDtype:r=`float32`,outputDtype:i=`float16`}){if(e%32!=0)throw Error(`dense subgroup matmul requires inFeatures divisible by 32`);if(t%64!=0)throw Error(`dense subgroup matmul requires outFeatures divisible by 64`);if(i!==`float16`&&i!==`float32`)throw Error(`dense subgroup matmul requires f16/f32 output`);let a=kn(n),o=kn(r),s=kn(i),c=s,l=i===`float16`?`0.0h`:`0.0`,u=i===`float16`?n===`float16`?`x[a_global * IN_F + k]`:`f16(x[a_global * IN_F + k])`:jn(`x[a_global * IN_F + k]`,n),d=i===`float16`?r===`float16`?`w[w_global * IN_F + k]`:`f16(w[w_global * IN_F + k])`:jn(`w[w_global * IN_F + k]`,r);return`${An(n,r,i)}enable subgroups;
enable chromium_experimental_subgroup_matrix;
diagnostic(off, chromium.subgroup_matrix_uniformity);

struct Params { M: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       x: array<${a}>;
@group(0) @binding(1) var<storage, read>       w: array<${o}>;
@group(0) @binding(2) var<storage, read_write> y: array<${s}>;
@group(0) @binding(3) var<uniform>             params: Params;

const IN_F:       u32 = ${e}u;
const OUT_F:      u32 = ${t}u;
const TILE_COLS:  u32 = 64u;
const TILE_ROWS:  u32 = 32u;
const TILE_K:     u32 = 32u;
const SUB_COLS:   u32 = 32u;
const SUB_ROWS:   u32 = 16u;

var<workgroup> tile_A: array<${c}, 32 * 32>;
var<workgroup> tile_B: array<${c}, 64 * 32>;
var<workgroup> scratch: array<array<array<${c}, 64>, 4>, 4>;

fn loadSHMA(tile_base: u32, k_idx: u32, row: u32, c_idx: u32) {
  let a_global: u32 = tile_base + row;
  let col: u32 = c_idx * 8u;
  for (var col_offset: u32 = 0u; col_offset < 8u; col_offset++) {
    let k: u32 = k_idx + col + col_offset;
    if (a_global < params.M) {
      tile_A[row * TILE_K + col + col_offset] = ${u};
    } else {
      tile_A[row * TILE_K + col + col_offset] = ${l};
    }
  }
}

fn loadSHMB(tile_base: u32, k_idx: u32, row: u32, c_idx: u32) {
  let w_global: u32 = tile_base + row;
  let col: u32 = c_idx * 16u;
  for (var i: u32 = 0u; i < 16u; i++) {
    let k: u32 = k_idx + col + i;
    tile_B[row * TILE_K + col + i] = ${d};
  }
}

fn storeOutput(offset: u32, row: u32, col: u32, src_slot: u32, row_limit: i32) {
  if (row_limit > 0 && row < u32(row_limit)) {
    let col2: u32 = col + 1u;
    y[offset + row * OUT_F + col]       = scratch[src_slot][0][row * 8u + col];
    y[offset + row * OUT_F + col + 8u]  = scratch[src_slot][1][row * 8u + col];
    y[offset + row * OUT_F + col + 16u] = scratch[src_slot][2][row * 8u + col];
    y[offset + row * OUT_F + col + 24u] = scratch[src_slot][3][row * 8u + col];

    y[offset + row * OUT_F + col2]       = scratch[src_slot][0][row * 8u + col2];
    y[offset + row * OUT_F + col2 + 8u]  = scratch[src_slot][1][row * 8u + col2];
    y[offset + row * OUT_F + col2 + 16u] = scratch[src_slot][2][row * 8u + col2];
    y[offset + row * OUT_F + col2 + 24u] = scratch[src_slot][3][row * 8u + col2];
  }
}

@compute @workgroup_size(128, 1, 1)
fn main(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_index) local_idx: u32,
  @builtin(subgroup_invocation_id) sg_id: u32,
  @builtin(subgroup_size) sg_size: u32
) {
  let a_global_base: u32 = workgroup_id.y * TILE_ROWS;
  let w_global_base: u32 = workgroup_id.x * TILE_COLS;

  let subtile_id: u32 = local_idx / sg_size;
  let subtile_idx: u32 = subtile_id / 2u;
  let subtile_idy: u32 = subtile_id % 2u;
  let base_A: u32 = subtile_idy * SUB_ROWS;
  let base_B: u32 = subtile_idx * SUB_COLS;

  var matC00: subgroup_matrix_result<${c}, 8, 8>;
  var matC01: subgroup_matrix_result<${c}, 8, 8>;
  var matC02: subgroup_matrix_result<${c}, 8, 8>;
  var matC03: subgroup_matrix_result<${c}, 8, 8>;
  var matC10: subgroup_matrix_result<${c}, 8, 8>;
  var matC11: subgroup_matrix_result<${c}, 8, 8>;
  var matC12: subgroup_matrix_result<${c}, 8, 8>;
  var matC13: subgroup_matrix_result<${c}, 8, 8>;

  for (var kidx: u32 = 0u; kidx < IN_F; kidx += TILE_K) {
    loadSHMA(a_global_base, kidx, local_idx / 4u, local_idx % 4u);
    loadSHMB(w_global_base, kidx, local_idx / 2u, local_idx % 2u);
    workgroupBarrier();

    for (var step: u32 = 0u; step < TILE_K; step += 8u) {
      let matrix_a_offset: u32 = subtile_idy * SUB_ROWS * TILE_K + step;
      var matA0: subgroup_matrix_left<${c}, 8, 8> = subgroupMatrixLoad<subgroup_matrix_left<${c}, 8, 8>>(&tile_A, matrix_a_offset, false, TILE_K);
      var matA1: subgroup_matrix_left<${c}, 8, 8> = subgroupMatrixLoad<subgroup_matrix_left<${c}, 8, 8>>(&tile_A, matrix_a_offset + 8u * TILE_K, false, TILE_K);

      let matrix_b_offset: u32 = subtile_idx * SUB_COLS * TILE_K + step;
      var matB0: subgroup_matrix_right<${c}, 8, 8> = subgroupMatrixLoad<subgroup_matrix_right<${c}, 8, 8>>(&tile_B, matrix_b_offset, true, TILE_K);
      var matB1: subgroup_matrix_right<${c}, 8, 8> = subgroupMatrixLoad<subgroup_matrix_right<${c}, 8, 8>>(&tile_B, matrix_b_offset +  8u * TILE_K, true, TILE_K);
      var matB2: subgroup_matrix_right<${c}, 8, 8> = subgroupMatrixLoad<subgroup_matrix_right<${c}, 8, 8>>(&tile_B, matrix_b_offset + 16u * TILE_K, true, TILE_K);
      var matB3: subgroup_matrix_right<${c}, 8, 8> = subgroupMatrixLoad<subgroup_matrix_right<${c}, 8, 8>>(&tile_B, matrix_b_offset + 24u * TILE_K, true, TILE_K);

      matC00 = subgroupMatrixMultiplyAccumulate(matA0, matB0, matC00);
      matC01 = subgroupMatrixMultiplyAccumulate(matA0, matB1, matC01);
      matC02 = subgroupMatrixMultiplyAccumulate(matA0, matB2, matC02);
      matC03 = subgroupMatrixMultiplyAccumulate(matA0, matB3, matC03);
      matC10 = subgroupMatrixMultiplyAccumulate(matA1, matB0, matC10);
      matC11 = subgroupMatrixMultiplyAccumulate(matA1, matB1, matC11);
      matC12 = subgroupMatrixMultiplyAccumulate(matA1, matB2, matC12);
      matC13 = subgroupMatrixMultiplyAccumulate(matA1, matB3, matC13);
    }
    workgroupBarrier();
  }

  subgroupMatrixStore(&scratch[subtile_id][0], 0u, matC00, false, 8u);
  subgroupMatrixStore(&scratch[subtile_id][1], 0u, matC01, false, 8u);
  subgroupMatrixStore(&scratch[subtile_id][2], 0u, matC02, false, 8u);
  subgroupMatrixStore(&scratch[subtile_id][3], 0u, matC03, false, 8u);
  let row: u32 = sg_id / 4u;
  let col: u32 = (sg_id % 4u) * 2u;
  var matrix_c_offset: u32 = (a_global_base + base_A) * OUT_F + w_global_base + base_B;
  var row_limit: i32 = i32(params.M) - i32(a_global_base + base_A);
  storeOutput(matrix_c_offset, row, col, subtile_id, row_limit);

  subgroupMatrixStore(&scratch[subtile_id][0], 0u, matC10, false, 8u);
  subgroupMatrixStore(&scratch[subtile_id][1], 0u, matC11, false, 8u);
  subgroupMatrixStore(&scratch[subtile_id][2], 0u, matC12, false, 8u);
  subgroupMatrixStore(&scratch[subtile_id][3], 0u, matC13, false, 8u);
  matrix_c_offset = matrix_c_offset + 8u * OUT_F;
  row_limit = i32(params.M) - i32(a_global_base + base_A + 8u);
  storeOutput(matrix_c_offset, row, col, subtile_id, row_limit);
}
`}async function or(e,{aT:t,wT:n,bT:r,outT:i,M:a,inFeatures:o,outFeatures:s}){let c=t.dtype,l=n.dtype,u=r?.dtype??`float32`,d=i.dtype;if(!r&&e.caps().subgroupMatrix&&(d===`float16`&&e.caps().f16||d===`float32`&&a>=32)&&o%32==0&&s%64==0){let r=`dense_sgmat_${d===`float16`?`f16`:`f32`}_${o}_${s}_${c}_${l}_${d}_tm32_tn64`,u=ar({inFeatures:o,outFeatures:s,inputDtype:c,weightDtype:l,outputDtype:d}),f=Qt(e,[{u32:a}],`dense-sgmat-params`);await e.runProgram({name:`dense_matmul`,source:u,cacheKey:r,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:i,type:`storage`},{buffer:f,type:`uniform`}],workgroups:[Math.ceil(s/64),Math.ceil(a/32),1]});return}let f=`dense_m_${o}_${s}_${r?`b`:`nb`}_${c}_${l}_${u}_${d}`,p=er({inFeatures:o,outFeatures:s,hasBias:!!r,inputDtype:c,weightDtype:l,biasDtype:u,outputDtype:d}),m=Qt(e,[{u32:a}],`dense-params`),h=[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},...r?[{tensor:r,type:`read-only-storage`}]:[],{tensor:i,type:`storage`},{buffer:m,type:`uniform`}];await e.runProgram({name:`dense_matmul`,source:p,cacheKey:f,bindings:h,workgroups:[s,a,1]})}var sr=[8,17,26],cr=class e{constructor({rt:e,config:t,embedBitsT:n,embedScaleBiasT:r,layers:i,finalNormT:a,hiddenLayerIndices:o}){this.rt=e,this.config=t,this.embedBitsT=n,this.embedScaleBiasT=r,this.layers=i,this.finalNormT=a,this.hiddenLayerIndices=o}static async fromMlxSafeTensors({rt:t,config:n,safeTensors:r,hiddenLayerIndices:i=sr,onProgress:a=null,concurrency:o,chunkMaxBytes:s,signal:c}){let l=n.quantization?.group_size??n.quantization_config?.group_size??64,u=Kt(n.quantization?.bits??n.quantization_config?.bits??4),d=!!t.caps().f16,f=n.hidden_size,p=n.intermediate_size,m=n.num_attention_heads,h=n.num_key_value_heads,g=n.head_dim,_=m*g,v=h*g,y=Math.max(...i);if(!Number.isInteger(y)||y<0||y>=n.num_hidden_layers)throw Error(`hiddenLayerIndices must be within [0, ${n.num_hidden_layers-1}]`);let b=y+1,x={embedQ:null,layers:Array(b)};for(let e=0;e<b;++e)x.layers[e]={};let S=Zt(),C=(e,n,r,i)=>{S.group([`${e}.weight`,`${e}.scales`,`${e}.biases`],async({[`${e}.weight`]:a,[`${e}.scales`]:o,[`${e}.biases`]:s})=>{let c=t.allocateWeightsBuffer({byteLength:a.byteLength,dtype:`uint32`,shape:[n,r/u],label:`${e}.bits`});t.writeWeightsRange(c,0,a);let f=Yt({scalesBytes:o,biasesBytes:s,outFeatures:n,inFeatures:r,groupSize:l,dtype:d?`f16`:`f32`}),p=t.tensorFromTypedArray(d?`float16`:`float32`,[n,r/l,2],f);i.bitsT=c,i.sbT=p})},w=(e,n)=>{S.tensor(e,async e=>{let r=jt(e);n(t.tensorFromTypedArray(`float32`,[r.length],r))})};x.embedQ={},C(`model.embed_tokens`,n.vocab_size,n.hidden_size,x.embedQ);for(let e=0;e<b;++e){let t=`model.layers.${e}`,n=x.layers[e];n.qProj={},n.kProj={},n.vProj={},n.oProj={},n.gateProj={},n.upProj={},n.downProj={},w(`${t}.input_layernorm.weight`,e=>{n.inputLn=e}),w(`${t}.post_attention_layernorm.weight`,e=>{n.postAttnLn=e}),w(`${t}.self_attn.q_norm.weight`,e=>{n.qNorm=e}),w(`${t}.self_attn.k_norm.weight`,e=>{n.kNorm=e}),C(`${t}.self_attn.q_proj`,_,f,n.qProj),C(`${t}.self_attn.k_proj`,v,f,n.kProj),C(`${t}.self_attn.v_proj`,v,f,n.vProj),C(`${t}.self_attn.o_proj`,f,_,n.oProj),C(`${t}.mlp.gate_proj`,p,f,n.gateProj),C(`${t}.mlp.up_proj`,p,f,n.upProj),C(`${t}.mlp.down_proj`,f,p,n.downProj)}return await r.streamAll(S.onChunk,{concurrency:o,chunkMaxBytes:s,names:S.names(),onProgress:a,signal:c}),S.assertComplete(),new e({rt:t,config:n,embedBitsT:x.embedQ.bitsT,embedScaleBiasT:x.embedQ.sbT,layers:x.layers,finalNormT:null,hiddenLayerIndices:i})}async encode(e,{scope:t=null}={}){let n=!t,r=t??Vt(),i=Ht(this.rt,r);try{let t=await this._encodeWithRuntime(e,i);return n&&r.keep(t.hiddenStackT),t}finally{n&&r.destroy()}}async _encodeWithRuntime(e,t){let n=this.config,r=e.length,i=n.hidden_size,a=n.num_attention_heads,o=n.num_key_value_heads,s=n.head_dim,c=a*s,l=o*s,u=n.intermediate_size,d=n.rope_theta??1e6,f=n.rms_norm_eps??1e-6,p=new Set(this.hiddenLayerIndices),m=this.hiddenLayerIndices.length,h=t.caps().f16?`float16`:`float32`,g=t.tensorFromTypedArray(`uint32`,[r],e),_=t.empty(h,[r,i],`qwen3-hidden`);await lr(t,{idsT:g,bitsT:this.embedBitsT,sbT:this.embedScaleBiasT,yT:_,seq:r,hidden:i,vocab:n.vocab_size,bits:n.quantization?.bits??n.quantization_config?.bits??4,groupSize:n.quantization?.group_size??n.quantization_config?.group_size??64});let v=s/2,y=new Float32Array(r*v),b=new Float32Array(r*v);for(let e=0;e<r;++e)for(let t=0;t<v;++t){let n=1/d**(2*t/s),r=e*n;y[e*v+t]=Math.cos(r),b[e*v+t]=Math.sin(r)}let x=t.tensorFromTypedArray(`float32`,[r,v],y),S=t.tensorFromTypedArray(`float32`,[r,v],b),C=t.empty(h,[r,i],`qwen3-normed`),w=t.empty(h,[r,c],`qwen3-q`),T=t.empty(h,[r,l],`qwen3-k`),E=t.empty(h,[r,l],`qwen3-v`),D=t.empty(h,[r,c],`qwen3-q-normed`),O=t.empty(h,[r,l],`qwen3-k-normed`),k=t.empty(h,[r,c],`qwen3-attn`),A=t.empty(h,[r,i],`qwen3-oproj`),j=t.empty(h,[r,u],`qwen3-gate`),M=t.empty(h,[r,u],`qwen3-up`),N=t.empty(h,[r,i],`qwen3-ff`),P=t.empty(h,[r,m*i],`qwen3-stack`),F=n.quantization?.bits??n.quantization_config?.bits??4,I=n.quantization?.group_size??n.quantization_config?.group_size??64;for(let e=0;e<this.layers.length;++e){let n=this.layers[e];if(await Nn(t,{xT:_,wT:n.inputLn,yT:C,rows:r,dim:i,eps:f}),await $n(t,{aT:C,bitsT:n.qProj.bitsT,sbT:n.qProj.sbT,outT:w,M:r,inFeatures:i,outFeatures:c,bits:F,groupSize:I}),await $n(t,{aT:C,bitsT:n.kProj.bitsT,sbT:n.kProj.sbT,outT:T,M:r,inFeatures:i,outFeatures:l,bits:F,groupSize:I}),await $n(t,{aT:C,bitsT:n.vProj.bitsT,sbT:n.vProj.sbT,outT:E,M:r,inFeatures:i,outFeatures:l,bits:F,groupSize:I}),await Nn(t,{xT:w,wT:n.qNorm,yT:D,rows:r*a,dim:s,eps:f}),await Nn(t,{xT:T,wT:n.kNorm,yT:O,rows:r*o,dim:s,eps:f}),await Pn(t,{xT:D,cosT:x,sinT:S,seq:r,heads:a,headDim:s}),await Pn(t,{xT:O,cosT:x,sinT:S,seq:r,heads:o,headDim:s}),await Wn(t,{qT:D,kT:O,vT:E,outT:k,seq:r,qHeads:a,kvHeads:o,headDim:s,causal:!0}),await $n(t,{aT:k,bitsT:n.oProj.bitsT,sbT:n.oProj.sbT,outT:A,M:r,inFeatures:c,outFeatures:i,bits:F,groupSize:I}),await Ln(t,{xT:_,yT:A,count:r*i,alpha:1}),await Nn(t,{xT:_,wT:n.postAttnLn,yT:C,rows:r,dim:i,eps:f}),await $n(t,{aT:C,bitsT:n.gateProj.bitsT,sbT:n.gateProj.sbT,outT:j,M:r,inFeatures:i,outFeatures:u,bits:F,groupSize:I}),await $n(t,{aT:C,bitsT:n.upProj.bitsT,sbT:n.upProj.sbT,outT:M,M:r,inFeatures:i,outFeatures:u,bits:F,groupSize:I}),await Fn(t,{xT:j,count:r*u}),await Un(t,{xT:j,factorT:M,count:r*u,period:0}),await $n(t,{aT:j,bitsT:n.downProj.bitsT,sbT:n.downProj.sbT,outT:N,M:r,inFeatures:u,outFeatures:i,bits:F,groupSize:I}),await Ln(t,{xT:_,yT:N,count:r*i,alpha:1}),p.has(e)){let n=this.hiddenLayerIndices.indexOf(e);await ur(t,{srcT:_,dstT:P,rows:r,srcRowStrideEl:i,srcStartCol:0,dstRowStrideEl:m*i,dstStartCol:n*i,copyCols:i})}}return{hiddenStackT:P,seq:r,stackDim:m*i}}destroy(){Bt({embedBitsT:this.embedBitsT,embedScaleBiasT:this.embedScaleBiasT,layers:this.layers,finalNormT:this.finalNormT}),this.embedBitsT=null,this.embedScaleBiasT=null,this.layers=[],this.finalNormT=null}};async function lr(e,{idsT:t,bitsT:n,sbT:r,yT:i,seq:a,hidden:o,vocab:s,bits:c,groupSize:l}){if(c!==4)throw Error(`only bits=4 supported in mlxEmbedGather for now`);let u=o/8,d=o/l,f=r.dtype===`float16`?`f16`:`f32`,p=i.dtype===`float16`?`f16`:`f32`,m=`${f===`f16`||p===`f16`?`enable f16;
`:``}struct Params { seq: u32, _pad0: u32, _pad1: u32, _pad2: u32 };
@group(0) @binding(0) var<storage, read>       ids: array<u32>;
@group(0) @binding(1) var<storage, read>       bits_buf: array<u32>;
@group(0) @binding(2) var<storage, read>       scaleBias: array<${f}>;
@group(0) @binding(3) var<storage, read_write> y: array<${p}>;
@group(0) @binding(4) var<uniform>             params: Params;

const HIDDEN:        u32 = ${o}u;
const VOCAB:         u32 = ${s}u;
const GROUP_SIZE:    u32 = ${l}u;
const NUM_GROUPS:    u32 = ${d}u;
const WORDS_PER_ROW: u32 = ${u}u;
const VALS_PER_WORD: u32 = 8u;
const BITS:          u32 = ${c}u;
const MASK:          u32 = 0xfu;
const WG: u32 = 64u;

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let t = wg.x;
  if (t >= params.seq) { return; }
  let id = ids[t];
  if (id >= VOCAB) { return; }

  let row_words_base: u32 = id * WORDS_PER_ROW;
  let row_sb_base:    u32 = id * NUM_GROUPS * 2u;

  // Each thread fills VALS_PER_WORD output positions per word it handles.
  var w: u32 = lid.x;
  loop {
    if (w >= WORDS_PER_ROW) { break; }
    let packed: u32 = bits_buf[row_words_base + w];
    let colBase: u32 = w * VALS_PER_WORD;
    let g: u32 = colBase / GROUP_SIZE;
    let scale: f32 = f32(scaleBias[row_sb_base + g * 2u]);
    let bias:  f32 = f32(scaleBias[row_sb_base + g * 2u + 1u]);
    for (var v: u32 = 0u; v < VALS_PER_WORD; v = v + 1u) {
      let q: f32 = f32((packed >> (v * BITS)) & MASK);
      y[t * HIDDEN + colBase + v] = ${p===`f16`?`f16(scale * q + bias)`:`scale * q + bias`};
    }
    w = w + WG;
  }
}
`,h=e.createUniformU32([a,0,0,0],`embed-gather-params`);await e.runProgram({name:`mlx_embed_gather`,source:m,entryPoint:`main`,cacheKey:`mlx_embed_gather_${f}_${p}_h${o}_v${s}_g${l}_b${c}`,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:i,type:`storage`},{buffer:h,type:`uniform`}],workgroups:[a,1,1]})}async function ur(e,{srcT:t,dstT:n,rows:r,srcRowStrideEl:i,srcStartCol:a,dstRowStrideEl:o,dstStartCol:s,copyCols:c}){let l=t.dtype===`float16`?`f16`:`f32`,u=n.dtype===`float16`?`f16`:`f32`,d=l===`f16`||u===`f16`?`enable f16;
`:``,f=l===`f16`?`f32(s[r * p.srcStride + p.srcStart + i])`:`s[r * p.srcStride + p.srcStart + i]`,p=u===`f16`?`f16(${f})`:f,m=`strided_copy_${t.dtype}_${n.dtype}`,h=`${d}struct Params { rows: u32, copyCols: u32, srcStride: u32, srcStart: u32, dstStride: u32, dstStart: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       s: array<${l}>;
@group(0) @binding(1) var<storage, read_write> d: array<${u}>;
@group(0) @binding(2) var<uniform>             p: Params;
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let r = wg.x;
  if (r >= p.rows) { return; }
  var i: u32 = lid.x;
  loop {
    if (i >= p.copyCols) { break; }
    d[r * p.dstStride + p.dstStart + i] = ${p};
    i = i + 64u;
  }
}
`,g=new ArrayBuffer(32),_=new Uint32Array(g);_[0]=r,_[1]=c,_[2]=i,_[3]=a,_[4]=o,_[5]=s;let v=e.createUniformU32(new Uint32Array(g),`strided-copy-params`);await e.runProgram({name:`strided_copy`,source:h,entryPoint:`main`,cacheKey:m,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`storage`},{buffer:v,type:`uniform`}],workgroups:[r,1,1]})}function dr(e,t){let n=16927e-8,r=.45666666;if(e>4300)return n*e+r;let i=n*e+r,a=(i-(873809524e-13*e+1.89833333))/190,o=i-200*a;return a*t+o}function fr(e,t,n=1){let r=Math.exp(e);if(typeof t==`number`)return r/(r+(1/t-1)**n);let i=new Float32Array(t.length);for(let e=0;e<t.length;++e)i[e]=r/(r+(1/t[e]-1)**n);return i}var pr=class e{constructor(e={}){if(this.num_train_timesteps=e.num_train_timesteps??1e3,this.shift=e.shift??1,this.use_dynamic_shifting=e.use_dynamic_shifting??!1,this.base_image_seq_len=e.base_image_seq_len??256,this.max_image_seq_len=e.max_image_seq_len??4096,this.base_shift=e.base_shift??.5,this.max_shift=e.max_shift??1.15,this.shift_terminal=e.shift_terminal??null,this.time_shift_type=e.time_shift_type??`exponential`,this.invert_sigmas=e.invert_sigmas??!1,this.stochastic_sampling=e.stochastic_sampling??!1,this.use_beta_sigmas=e.use_beta_sigmas??!1,this.use_exponential_sigmas=e.use_exponential_sigmas??!1,this.use_karras_sigmas=e.use_karras_sigmas??!1,this.time_shift_type!==`exponential`)throw Error(`Unsupported time_shift_type: ${this.time_shift_type}`);if(this.use_beta_sigmas||this.use_exponential_sigmas||this.use_karras_sigmas)throw Error(`Alternative sigma schedules not implemented`);if(this.shift_terminal!==null)throw Error(`shift_terminal stretch not implemented`);if(this.invert_sigmas)throw Error(`invert_sigmas not implemented`);this.sigmas=null,this.timesteps=null,this.numInferenceSteps=null,this._stepIndex=null}static fromConfig(t){return new e(t)}setTimesteps({numInferenceSteps:e,mu:t}){if(this.use_dynamic_shifting&&t==null)throw Error(`mu is required when use_dynamic_shifting=true`);let n=1/this.num_train_timesteps,r=this.num_train_timesteps,i=new Float32Array(e);if(e===1)i[0]=1*r;else{let t=1*r,a=(n*r-t)/(e-1);for(let n=0;n<e;++n)i[n]=t+n*a}let a=new Float32Array(e);for(let t=0;t<e;++t)a[t]=i[t]/r;if(this.use_dynamic_shifting)a=fr(t,a,1);else if(this.shift!==1){let t=new Float32Array(e);for(let n=0;n<e;++n){let e=a[n];t[n]=this.shift*e/(1+(this.shift-1)*e)}a=t}let o=new Float32Array(e);for(let t=0;t<e;++t)o[t]=a[t]*r;let s=new Float32Array(e+1);s.set(a),s[e]=0,this.sigmas=s,this.timesteps=o,this.numInferenceSteps=e,this._stepIndex=null}stepDelta(e){if(this.sigmas===null)throw Error(`setTimesteps not called`);if(e<0||e>=this.numInferenceSteps)throw Error(`stepIndex ${e} out of range`);return this.sigmas[e+1]-this.sigmas[e]}stepCpu(e,t,n){let r=this.stepDelta(t);if(e.length!==n.length)throw Error(`modelOutput and sample length mismatch`);let i=new Float32Array(n.length);for(let t=0;t<n.length;++t)i[t]=n[t]+r*e[t];return i}},mr=new Uint8Array([137,80,78,71,13,10,26,10]),hr=null;function gr(){let e=new Uint32Array(256);for(let t=0;t<256;++t){let n=t;for(let e=0;e<8;++e)n=n&1?(3988292384^n>>>1)>>>0:n>>>1;e[t]=n>>>0}return e}function _r(e){hr||=gr();let t=4294967295;for(let n=0;n<e.byteLength;++n)t=(hr[(t^e[n])&255]^t>>>8)>>>0;return(t^4294967295)>>>0}function vr(e,t){let n=new TextEncoder().encode(e);if(n.length!==4)throw Error(`chunk type must be 4 bytes: ${e}`);let r=new Uint8Array(8+t.byteLength+4),i=new DataView(r.buffer);i.setUint32(0,t.byteLength,!1),r.set(n,4),r.set(t,8);let a=new Uint8Array(4+t.byteLength);return a.set(n,0),a.set(t,4),i.setUint32(8+t.byteLength,_r(a),!1),r}function yr(e,t){let n=new Uint8Array(13),r=new DataView(n.buffer);return r.setUint32(0,e,!1),r.setUint32(4,t,!1),n[8]=8,n[9]=2,n[10]=0,n[11]=0,n[12]=0,n}function br(e,t,n){if(!Number.isInteger(e)||e<=0)throw Error(`width must be positive integer`);if(!Number.isInteger(t)||t<=0)throw Error(`height must be positive integer`);if(!(n instanceof Uint8Array))throw Error(`rgb must be Uint8Array`);if(n.byteLength!==e*t*3)throw Error(`rgb length ${n.byteLength} != width*height*3 = ${e*t*3}`);let r=e*3,i=new Uint8Array(t*(1+r));for(let e=0;e<t;++e)i[e*(1+r)]=0,i.set(n.subarray(e*r,(e+1)*r),e*(1+r)+1);let a=xr(i),o=[mr,vr(`IHDR`,yr(e,t)),vr(`IDAT`,a),vr(`IEND`,new Uint8Array)],s=0;for(let e of o)s+=e.byteLength;let c=new Uint8Array(s),l=0;for(let e of o)c.set(e,l),l+=e.byteLength;return c}function xr(e){let t=Math.ceil(e.byteLength/65535),n=new Uint8Array(2+t*5+e.byteLength+4),r=0;n[r++]=120,n[r++]=1;let i=0;for(;i<e.byteLength;){let t=Math.min(65535,e.byteLength-i),a=i+t===e.byteLength;n[r++]=+!!a,n[r++]=t&255,n[r++]=t>>>8;let o=~t&65535;n[r++]=o&255,n[r++]=o>>>8,n.set(e.subarray(i,i+t),r),r+=t,i+=t}let a=Sr(e);return n[r++]=a>>>24&255,n[r++]=a>>>16&255,n[r++]=a>>>8&255,n[r++]=a&255,n}function Sr(e){let t=1,n=0;for(let r=0;r<e.byteLength;++r)t+=e[r],n+=t,(r&4095)==4095&&(t%=65521,n%=65521);return t%=65521,n%=65521,(n<<16|t)>>>0}function Cr(e){let t={}.BONSAI_FORCE_DENSE_F16_MATMUL;return t===`1`||t===`true`?!0:t===`0`||t===`false`?!1:e.caps().f16&&e.caps().adapter?.vendor===`apple`}function wr(e,t,n){let r=e.quantization_config??e.quantization??{},i=Tr(t,`transformer_blocks.0.attn.to_q.weight`,n),a=Number(r.bits??r.nbits??i??2),o=Number(r.group_size??r.groupSize??128);if(![1,2].includes(a))throw Error(`Flux2 transformer MLX weights require 1-bit or 2-bit quantization, got bits=${a}`);if(o!==128)throw Error(`Flux2 transformer MLX weights require group_size=128, got ${o}`);if(i!=null&&i!==a)throw Error(`Flux2 transformer weight shape implies ${i}-bit packing, but quantization_config says ${a}-bit`);return{bits:a,groupSize:o,quantSolver:r.solver??null}}function Tr(e,t,n){if(!e.has?.(t))return null;let r=e.info(t).shape;if(r.length!==2)return null;let i=r[1]*32;if(i%n!==0)return null;let a=i/n;return Number.isInteger(a)?a:null}function Er(e,t){if(e.byteLength!==t.byteLength)return!1;for(let n=0;n<e.byteLength;n+=2){let r=e[n]|e[n+1]<<8,i=r&32640;if(i===0||i===32640)return!1;let a=((r&32767)-128|32768)&65535;if((t[n]|t[n+1]<<8)!==a)return!1}return!0}function Dr(e,t,n){let r=t.byteLength+3&-4,i=e.allocateWeightsBuffer({byteLength:r,dtype:`uint32`,shape:[r/4],label:n});return e.writeWeightsRange(i,0,t),i.scaleBiasDtype=`bfloat16`,i.scaleBiasLayout=`out-group`,i}function Or(e){return e===`float16`?2:4}function kr(e){return e===`float16`?`f16`:`f32`}function Ar(...e){return e.includes(`float16`)?`enable f16;
`:``}function jr(e,t){return t===`float16`?`f32(${e})`:e}function Mr(e,t){return t===`float16`?`f16(${e})`:e}var Nr=class e{constructor({rt:e,config:t,w:n}){this.rt=e,this.config=t,this.w=n,this.ropeCache=new Map}destroy(){Bt(this.w),Bt(this.ropeCache),this.w=null,this.ropeCache=new Map}static async fromMlxSafeTensors({rt:t,config:n,safeTensors:r,onProgress:i=null,concurrency:a,chunkMaxBytes:o,signal:s}){let c=n.num_layers,l=n.num_single_layers,u=n.num_attention_heads*n.attention_head_dim,{bits:d,groupSize:f,quantSolver:p}=wr(n,r,u),m=Kt(d),h=!!t.caps().f16,g=n.joint_attention_dim,_=n.in_channels,v=n.out_channels??_,y=n.timestep_guidance_channels??256,b=n.mlp_ratio??3,x=Math.floor(u*b),S=3*u+x*2,C=u+x,w=Cr(t),T=!!(d===1&&f===128&&t.caps().f16),E=!!(d===2&&f===128&&p===`ternary`&&t.caps().f16),D=t.caps().subgroupMatrix&&!w&&!T&&h?`group-out`:`out-group`,O=!!(t.caps().f16&&!T&&(!t.caps().subgroupMatrix||w)),k=Zt(),A=(e,n,r,i,a={})=>{let o=!!(a.denseF16&&E),s=o?[`${e}.weight`,`${e}.scales`]:[`${e}.weight`,`${e}.scales`,`${e}.biases`];k.group(s,async s=>{let c=s[`${e}.weight`],l=s[`${e}.scales`],u=s[`${e}.biases`],p=t.allocateWeightsBuffer({byteLength:c.byteLength,dtype:`uint32`,shape:[n,r/m],label:`${e}.bits`});t.writeWeightsRange(p,0,c);let g;if(o)g=Dr(t,l,`${e}.scales_bf16`),g.ternaryBiasFromScale=!0;else if(T&&Er(l,u)){let e=Mt(l);g=t.tensorFromTypedArray(`float16`,[n,r/f],e),g.scaleBiasLayout=`out-group`,g.binaryBiasIsNegHalfScale=!0,g.binaryScaleOnly=!0}else{let e=(D===`group-out`?Jt:Yt)({scalesBytes:l,biasesBytes:u,outFeatures:n,inFeatures:r,groupSize:f,dtype:h?`f16`:`f32`}),i=D===`group-out`?[r/f,n,2]:[n,r/f,2];g=t.tensorFromTypedArray(h?`float16`:`float32`,i,e),g.scaleBiasLayout=D,T&&(g.binaryBiasIsNegHalfScale=!1)}if(i.bitsT=p,i.sbT=g,a.denseF16){let a=t.empty(`float16`,[r,n],`${e}.dense_f16_kn`);await Yn(t,{bitsT:p,sbT:g,outT:a,inFeatures:r,outFeatures:n,bits:d,groupSize:f,outputLayout:`k-out`}),a.denseLayout=`k-out-vec4n`,i.denseT=a,i.denseLayout=`k-out-vec4n`}})},j=(e,n,r,i,a={})=>{let o=!!(a.denseF16&&E),s=r/m,c=r/f,l=n*e.length,u=Array(e.length),p=0,g=null,_=null,v=null,y=null,b=null,x=null,S=null,C=T,w=(n,r=null)=>{if(g)return;let i=n.byteLength*e.length;if(g=t.allocateWeightsBuffer({byteLength:i,dtype:`uint32`,shape:[l,s],label:`${e[0]}.fused_bits`}),T)y=new Uint16Array(l*c),x=Array(e.length),S=Array(e.length);else if(o){let n=r.byteLength*e.length+3&-4;b=t.allocateWeightsBuffer({byteLength:n,dtype:`uint32`,shape:[n/4],label:`${e[0]}.fused_scales_bf16`}),b.scaleBiasDtype=`bfloat16`,b.scaleBiasLayout=`out-group`,b.ternaryBiasFromScale=!0}else _=h?Uint16Array:Float32Array,v=new _(l*c*2)};e.forEach((s,m)=>{let E=o?[`${s}.weight`,`${s}.scales`]:[`${s}.weight`,`${s}.scales`,`${s}.biases`];k.group(E,async E=>{let O=E[`${s}.weight`],k=E[`${s}.scales`],A=E[`${s}.biases`];if(w(O,k),t.writeWeightsRange(g,O.byteLength*m,O),o)t.writeWeightsRange(b,k.byteLength*m,k);else if(T){x[m]=new Uint8Array(k),S[m]=new Uint8Array(A),Er(k,A)||(C=!1);let e=Mt(k);for(let t=0;t<n;++t){let r=t*c,i=(m*n+t)*c;y.set(e.subarray(r,r+c),i)}}else if(D===`group-out`){let e=Jt({scalesBytes:k,biasesBytes:A,outFeatures:n,inFeatures:r,groupSize:f,dtype:h?`f16`:`f32`});for(let t=0;t<c;++t){let r=(t*l+m*n)*2,i=t*n*2;v.set(e.subarray(i,i+n*2),r)}}else Xt({scalesBytes:k,biasesBytes:A,out:v,outFeatures:n,inFeatures:r,groupSize:f,dtype:h?`f16`:`f32`,dstElementOffset:m*n*c*2});if(u[m]=!0,++p===e.length){let s;if(o)s=b;else if(T&&C)s=t.tensorFromTypedArray(`float16`,[l,c],y),s.scaleBiasLayout=`out-group`,s.binaryBiasIsNegHalfScale=!0,s.binaryScaleOnly=!0;else{if(T){_=h?Uint16Array:Float32Array,v=new _(l*c*2);for(let t=0;t<e.length;++t)if(D===`group-out`){let e=Jt({scalesBytes:x[t],biasesBytes:S[t],outFeatures:n,inFeatures:r,groupSize:f,dtype:h?`f16`:`f32`});for(let r=0;r<c;++r){let i=(r*l+t*n)*2,a=r*n*2;v.set(e.subarray(a,a+n*2),i)}}else Xt({scalesBytes:x[t],biasesBytes:S[t],out:v,outFeatures:n,inFeatures:r,groupSize:f,dtype:h?`f16`:`f32`,dstElementOffset:t*n*c*2})}let i=D===`group-out`?[c,l,2]:[l,c,2];s=t.tensorFromTypedArray(h?`float16`:`float32`,i,v),s.scaleBiasLayout=D,T&&(s.binaryBiasIsNegHalfScale=!1)}if(i.bitsT=g,i.sbT=s,a.denseF16){let n=t.empty(`float16`,[r,l],`${e[0]}.fused_dense_f16_kn`);await Yn(t,{bitsT:g,sbT:s,outT:n,inFeatures:r,outFeatures:l,bits:d,groupSize:f,outputLayout:`k-out`}),n.denseLayout=`k-out-vec4n`,i.denseT=n,i.denseLayout=`k-out-vec4n`}v=null,y=null,b=null,x=null,S=null}})})},M=(e,n)=>{k.tensor(e,async e=>{let r=jt(e);n(t.tensorFromTypedArray(`float32`,[r.length],r))})},N=(e,t)=>{r.has(e)?M(e,t):t(null)},P={},F=(e,n,i,a)=>{k.tensor(e,async o=>{let s=r.has(e.replace(/\.weight$/,`.bias`)),c=t.caps().f16&&!s&&i%4==0&&a%4==0;if(!c){let e=jt(o);n.weight=t.tensorFromTypedArray(`float32`,[e.length],e)}if(c){let e=Pt(o,a,i);n.weightPackedKOutF16=t.tensorFromTypedArray(`float16`,[e.length],e)}})};P.x_embedder={},F(`x_embedder.weight`,P.x_embedder,_,u),N(`x_embedder.bias`,e=>{P.x_embedder.bias=e}),P.context_embedder={},F(`context_embedder.weight`,P.context_embedder,g,u),N(`context_embedder.bias`,e=>{P.context_embedder.bias=e}),P.time_text_embed={linear_1:{},linear_2:{}},M(`time_guidance_embed.timestep_embedder.linear_1.weight`,e=>{P.time_text_embed.linear_1.weight=e}),N(`time_guidance_embed.timestep_embedder.linear_1.bias`,e=>{P.time_text_embed.linear_1.bias=e}),M(`time_guidance_embed.timestep_embedder.linear_2.weight`,e=>{P.time_text_embed.linear_2.weight=e}),N(`time_guidance_embed.timestep_embedder.linear_2.bias`,e=>{P.time_text_embed.linear_2.bias=e}),P.double_stream_modulation_img={},M(`double_stream_modulation_img.linear.weight`,e=>{P.double_stream_modulation_img.weight=e}),N(`double_stream_modulation_img.linear.bias`,e=>{P.double_stream_modulation_img.bias=e}),P.double_stream_modulation_txt={},M(`double_stream_modulation_txt.linear.weight`,e=>{P.double_stream_modulation_txt.weight=e}),N(`double_stream_modulation_txt.linear.bias`,e=>{P.double_stream_modulation_txt.bias=e}),P.single_stream_modulation={},M(`single_stream_modulation.linear.weight`,e=>{P.single_stream_modulation.weight=e}),N(`single_stream_modulation.linear.bias`,e=>{P.single_stream_modulation.bias=e}),P.norm_out={},M(`norm_out.linear.weight`,e=>{P.norm_out.weight=e}),N(`norm_out.linear.bias`,e=>{P.norm_out.bias=e}),P.proj_out={},M(`proj_out.weight`,e=>{P.proj_out.weight=e}),N(`proj_out.bias`,e=>{P.proj_out.bias=e}),P.joint=[];for(let e=0;e<c;++e){let t=`transformer_blocks.${e}`,n={attn:{to_qkv:{},to_out_0:{},add_qkv:{},to_add_out:{}},ff:{linear_in:{},linear_out:{}},ff_context:{linear_in:{},linear_out:{}}};P.joint.push(n),j([`${t}.attn.to_q`,`${t}.attn.to_k`,`${t}.attn.to_v`],u,u,n.attn.to_qkv,{denseF16:O}),A(`${t}.attn.to_out.0`,u,u,n.attn.to_out_0,{denseF16:O}),j([`${t}.attn.add_q_proj`,`${t}.attn.add_k_proj`,`${t}.attn.add_v_proj`],u,u,n.attn.add_qkv,{denseF16:O}),A(`${t}.attn.to_add_out`,u,u,n.attn.to_add_out,{denseF16:O}),M(`${t}.attn.norm_q.weight`,e=>{n.attn.norm_q=e}),M(`${t}.attn.norm_k.weight`,e=>{n.attn.norm_k=e}),M(`${t}.attn.norm_added_q.weight`,e=>{n.attn.norm_added_q=e}),M(`${t}.attn.norm_added_k.weight`,e=>{n.attn.norm_added_k=e}),A(`${t}.ff.linear_in`,x*2,u,n.ff.linear_in,{denseF16:O}),A(`${t}.ff.linear_out`,u,x,n.ff.linear_out,{denseF16:O}),A(`${t}.ff_context.linear_in`,x*2,u,n.ff_context.linear_in,{denseF16:O}),A(`${t}.ff_context.linear_out`,u,x,n.ff_context.linear_out,{denseF16:O})}P.single=[];for(let e=0;e<l;++e){let t=`single_transformer_blocks.${e}`,n={attn:{to_qkv_mlp_proj:{},to_out:{}}};P.single.push(n),A(`${t}.attn.to_qkv_mlp_proj`,S,u,n.attn.to_qkv_mlp_proj,{denseF16:O}),A(`${t}.attn.to_out`,u,C,n.attn.to_out,{denseF16:O}),M(`${t}.attn.norm_q.weight`,e=>{n.attn.norm_q=e}),M(`${t}.attn.norm_k.weight`,e=>{n.attn.norm_k=e})}return await r.streamAll(k.onChunk,{concurrency:a,chunkMaxBytes:o,names:k.names(),onProgress:i,signal:s}),k.assertComplete(),new e({rt:t,config:{...n,inner_dim:u,mlp_inner:x,ts_channels:y,out_channels:v,bits:d,groupSize:f,quantSolver:p,fusedSingleOutRows:S,fusedSingleAttnOutInF:C},w:P})}getRopeTensors({textSeq:e,imageSeq:t,totalSeq:n,headDim:r,txtIds:i,imgIds:a}){let o=this.config.axes_dims_rope??[32,32,32,32],s=this.config.rope_theta??2e3,c=`${n}:${r}:${o.join(`,`)}:${s}:${Ir(i)}:${Ir(a)}`,l=this.ropeCache.get(c);if(l)return l;let u=new Float32Array((e+t)*4);u.set(i,0),u.set(a,e*4);let{cos:d,sin:f}=Fr(u,n,o,s);return l={cosT:this.rt.tensorFromTypedArray(`float32`,[n,r],d),sinT:this.rt.tensorFromTypedArray(`float32`,[n,r],f)},this.ropeCache.set(c,l),l}async forward({hiddenStatesT:e,encoderHiddenStatesT:t,timestep:n,imgIds:r,txtIds:i,scope:a=null}){let o=!a,s=a??Vt(),c=Ht(this.rt,s);try{let a=await this._forwardWithRuntime({hiddenStatesT:e,encoderHiddenStatesT:t,timestep:n,imgIds:r,txtIds:i},c);return o&&s.keep(a),a}finally{o&&s.destroy()}}async _forwardWithRuntime({hiddenStatesT:e,encoderHiddenStatesT:t,timestep:n,imgIds:r,txtIds:i},a){let o=this.config,s=this.w,c=o.inner_dim,l=o.num_attention_heads,u=o.attention_head_dim,d=o.mlp_inner,f=o.eps??1e-6,p=o.bits,m=o.groupSize,h=e.shape[0],g=t.shape[0],_=g+h,v=!!(p===1&&m===128&&a.caps().f16),y=!!(!v&&!Cr(a)&&a.caps().subgroupMatrix&&(p===1||p===2)&&m===128),b=y&&a.caps().f16,x=p===2&&o.quantSolver===`ternary`,S=a.caps().f16?`float16`:`float32`,C=Or(S),w=y?Math.ceil(_/32)*32:_,T=Pr(n*1e3,o.ts_channels),E=a.tensorFromTypedArray(`float32`,[1,o.ts_channels],T),D=a.empty(`float32`,[1,c],`ts-h1`);await or(a,{aT:E,wT:s.time_text_embed.linear_1.weight,bT:s.time_text_embed.linear_1.bias,outT:D,M:1,inFeatures:o.ts_channels,outFeatures:c}),await Fn(a,{xT:D,count:c});let O=a.empty(`float32`,[1,c],`temb`);await or(a,{aT:D,wT:s.time_text_embed.linear_2.weight,bT:s.time_text_embed.linear_2.bias,outT:O,M:1,inFeatures:c,outFeatures:c});let k=a.empty(`float32`,[1,c],`temb-silu`);await a.copyBufferToBuffer({src:O.buffer,dst:k.buffer,byteLength:c*4}),await Fn(a,{xT:k,count:c});let A=a.empty(`float32`,[1,c*6],`dbl-img-mod`);await or(a,{aT:k,wT:s.double_stream_modulation_img.weight,bT:s.double_stream_modulation_img.bias,outT:A,M:1,inFeatures:c,outFeatures:c*6});let j=a.empty(`float32`,[1,c*6],`dbl-txt-mod`);await or(a,{aT:k,wT:s.double_stream_modulation_txt.weight,bT:s.double_stream_modulation_txt.bias,outT:j,M:1,inFeatures:c,outFeatures:c*6});let M=a.empty(`float32`,[1,c*3],`single-mod`);await or(a,{aT:k,wT:s.single_stream_modulation.weight,bT:s.single_stream_modulation.bias,outT:M,M:1,inFeatures:c,outFeatures:c*3});let N=a.empty(S,[h,c],`hs`);if(S===`float16`&&!s.x_embedder.bias&&s.x_embedder.weightPackedKOutF16){let t=e.dtype===`float16`?e:a.empty(`float16`,[h,o.in_channels],`hidden-states-f16`);t!==e&&await Bn(a,{xT:e,yT:t,count:h*o.in_channels}),await ir(a,{aT:t,wT:s.x_embedder.weightPackedKOutF16,outT:N,M:h,inFeatures:o.in_channels,outFeatures:c})}else await or(a,{aT:e,wT:s.x_embedder.weight,bT:s.x_embedder.bias,outT:N,M:h,inFeatures:o.in_channels,outFeatures:c});let P=a.empty(S,[g,c],`ehs`);if(S===`float16`&&!s.context_embedder.bias&&s.context_embedder.weightPackedKOutF16){let e=t.dtype===`float16`?t:a.empty(`float16`,[g,o.joint_attention_dim],`encoder-hidden-states-f16`);e!==t&&await Bn(a,{xT:t,yT:e,count:g*o.joint_attention_dim}),await ir(a,{aT:e,wT:s.context_embedder.weightPackedKOutF16,outT:P,M:g,inFeatures:o.joint_attention_dim,outFeatures:c})}else await or(a,{aT:t,wT:s.context_embedder.weight,bT:s.context_embedder.bias,outT:P,M:g,inFeatures:o.joint_attention_dim,outFeatures:c});let{cosT:F,sinT:I}=this.getRopeTensors({textSeq:g,imageSeq:h,totalSeq:_,headDim:u,txtIds:i,imgIds:r}),ee=a.empty(S,[h,c],`norm-img`),L=a.empty(S,[g,c],`norm-txt`),te=a.empty(S,[h,c*3],`qkv-img`),R=a.empty(S,[g,c*3],`qkv-txt`),ne=a.empty(S,[h,c],`vi`),re=a.empty(S,[g,c],`vt`),ie=a.empty(S,[_,c],`q-full`),ae=a.empty(S,[_,c],`k-full`),oe=a.empty(S,[_,c],`v-full`),se=a.empty(S,[_,c],`attn-full`),ce=a.empty(S,[h,c],`o-img`),le=a.empty(S,[g,c],`o-txt`),ue=null,de=null,fe=()=>ue??=a.empty(S,[h,d*2],`ff-pre-img`),pe=()=>de??=a.empty(S,[g,d*2],`ff-pre-txt`),me=a.empty(S,[h,d],`ff-post-img`),he=a.empty(S,[g,d],`ff-post-txt`),z=a.empty(S,[h,c],`ff-out-img`),ge=a.empty(S,[g,c],`ff-out-txt`),_e=Lr(A,c),ve=Lr(j,c),B=Rr(M,c),ye=(e,t)=>({shiftT:e.t,scaleT:e.t,shiftOffset:e[`${t}ShiftOffset`],scaleOffset:e[`${t}ScaleOffset`]}),V=(e,t)=>({gateT:e.t,gateOffset:e[`${t}GateOffset`]}),H=async({aT:e,q:t,M:n,inFeatures:r})=>{y||p!==2||await qn(a,{aT:e,aQT:t.aQT,scaleAT:t.scaleAT,sumAT:t.sumAT,M:n,inFeatures:r,groupSize:m})},be=async({aT:e,q:t,bitsT:n,sbT:r,denseT:i,outT:o,M:s,inFeatures:l,outFeatures:u,aRowOffset:d=0})=>{if(y){await Xn(a,{aT:e,bitsT:n,sbT:r,outT:o,M:s,inFeatures:l,outFeatures:u,bits:p,groupSize:m,useF16:b,assumeTernaryBias:x,aRowOffset:d,scaleBiasLayout:r.scaleBiasLayout??`out-group`});return}if(v&&d===0&&e.dtype===`float16`&&r.dtype===`float16`&&o.dtype===`float16`&&(r.scaleBiasLayout??`out-group`)===`out-group`&&l%128==0){await Zn(a,{aT:e,bitsT:n,sbT:r,outT:o,M:s,inFeatures:l,outFeatures:u,assumeBiasNegHalfScale:!!r.binaryBiasIsNegHalfScale,scaleOnly:!!r.binaryScaleOnly});return}if(i&&e.dtype===`float16`&&o.dtype===`float16`){i.denseLayout===`k-out-vec4n`?s>=128&&l===c&&u>=c*3?await En(a,{aT:e,wT:i,outT:o,M:s,inFeatures:l,outFeatures:u}):await ir(a,{aT:e,wT:i,outT:o,M:s,inFeatures:l,outFeatures:u}):await nr(a,{aT:e,wT:i,outT:o,M:s,inFeatures:l,outFeatures:u});return}p===2&&t?await Jn(a,{aQT:t.aQT,scaleAT:t.scaleAT,sumAT:t.sumAT,bitsT:n,sbT:r,outT:o,M:s,inFeatures:l,outFeatures:u,bits:p,groupSize:m}):await Qn(a,{aT:e,bitsT:n,sbT:r,outT:o,M:s,inFeatures:l,outFeatures:u,bits:p,groupSize:m})},xe=p===2&&!y,Se=xe?Kn(a,{M:h,inFeatures:c,groupSize:m}):null,Ce=xe?Kn(a,{M:g,inFeatures:c,groupSize:m}):null,we=xe?Kn(a,{M:h,inFeatures:c,groupSize:m}):null,Te=xe?Kn(a,{M:g,inFeatures:c,groupSize:m}):null,Ee=xe?Kn(a,{M:h,inFeatures:d,groupSize:m}):null,De=xe?Kn(a,{M:g,inFeatures:d,groupSize:m}):null;for(let e=0;e<o.num_layers;++e){let t=s.joint[e];if(await zr(a,{xT:N,yT:ee,rows:h,dim:c,eps:f,...ye(_e,`msa`)}),await zr(a,{xT:P,yT:L,rows:g,dim:c,eps:f,...ye(ve,`msa`)}),t.attn.to_qkv.denseT||await H({aT:ee,q:Se,M:h,inFeatures:c}),t.attn.add_qkv.denseT||await H({aT:L,q:Ce,M:g,inFeatures:c}),await be({aT:ee,q:Se,bitsT:t.attn.to_qkv.bitsT,sbT:t.attn.to_qkv.sbT,denseT:t.attn.to_qkv.denseT,outT:te,M:h,inFeatures:c,outFeatures:c*3}),await be({aT:L,q:Ce,bitsT:t.attn.add_qkv.bitsT,sbT:t.attn.add_qkv.sbT,denseT:t.attn.add_qkv.denseT,outT:R,M:g,inFeatures:c,outFeatures:c*3}),await Wr(a,{srcT:R,wT:t.attn.norm_added_q,cosT:F,sinT:I,yT:ie,seq:g,heads:l,headDim:u,srcStride:c*3,srcStart:0,dstRowOffset:0,eps:f}),await Wr(a,{srcT:te,wT:t.attn.norm_q,cosT:F,sinT:I,yT:ie,seq:h,heads:l,headDim:u,srcStride:c*3,srcStart:0,dstRowOffset:g,eps:f}),await Wr(a,{srcT:R,wT:t.attn.norm_added_k,cosT:F,sinT:I,yT:ae,seq:g,heads:l,headDim:u,srcStride:c*3,srcStart:c,dstRowOffset:0,eps:f}),await Wr(a,{srcT:te,wT:t.attn.norm_k,cosT:F,sinT:I,yT:ae,seq:h,heads:l,headDim:u,srcStride:c*3,srcStart:c,dstRowOffset:g,eps:f}),await Hr(a,{srcT:te,dstT:ne,rows:h,srcStride:c*3,srcStart:2*c,dstStride:c,copyCols:c}),await Hr(a,{srcT:R,dstT:re,rows:g,srcStride:c*3,srcStart:2*c,dstStride:c,copyCols:c}),await Br(a,{aT:re,bT:ne,outT:oe,aElems:g*c,totalElems:_*c}),await Wn(a,{qT:ie,kT:ae,vT:oe,outT:se,seq:_,qHeads:l,kvHeads:l,headDim:u,causal:!1}),y)await be({aT:se,q:we,bitsT:t.attn.to_out_0.bitsT,sbT:t.attn.to_out_0.sbT,outT:ce,M:h,inFeatures:c,outFeatures:c,aRowOffset:g}),await be({aT:se,q:Te,bitsT:t.attn.to_add_out.bitsT,sbT:t.attn.to_add_out.sbT,outT:le,M:g,inFeatures:c,outFeatures:c});else{let e=a.empty(S,[g,c],`attn-txt`),n=a.empty(S,[h,c],`attn-img`);await a.copyBufferToBuffer({src:se.buffer,dst:e.buffer,srcOffset:0,byteLength:g*c*C}),await a.copyBufferToBuffer({src:se.buffer,dst:n.buffer,srcOffset:g*c*C,byteLength:h*c*C}),t.attn.to_out_0.denseT||await H({aT:n,q:we,M:h,inFeatures:c}),t.attn.to_add_out.denseT||await H({aT:e,q:Te,M:g,inFeatures:c}),await be({aT:n,q:we,bitsT:t.attn.to_out_0.bitsT,sbT:t.attn.to_out_0.sbT,denseT:t.attn.to_out_0.denseT,outT:ce,M:h,inFeatures:c,outFeatures:c}),await be({aT:e,q:Te,bitsT:t.attn.to_add_out.bitsT,sbT:t.attn.to_add_out.sbT,denseT:t.attn.to_add_out.denseT,outT:le,M:g,inFeatures:c,outFeatures:c})}if(await Vr(a,{xT:N,addT:ce,count:h*c,...V(_e,`msa`),inner:c}),await Vr(a,{xT:P,addT:le,count:g*c,...V(ve,`msa`),inner:c}),await zr(a,{xT:N,yT:ee,rows:h,dim:c,eps:f,...ye(_e,`mlp`)}),await zr(a,{xT:P,yT:L,rows:g,dim:c,eps:f,...ye(ve,`mlp`)}),t.ff.linear_in.denseT||await H({aT:ee,q:Se,M:h,inFeatures:c}),t.ff_context.linear_in.denseT||await H({aT:L,q:Ce,M:g,inFeatures:c}),t.ff.linear_in.denseT?.denseLayout===`k-out-vec4n`&&ee.dtype===`float16`&&me.dtype===`float16`)await On(a,{aT:ee,wT:t.ff.linear_in.denseT,outT:me,M:h,inFeatures:c,innerFeatures:d});else{let e=fe();await be({aT:ee,q:Se,bitsT:t.ff.linear_in.bitsT,sbT:t.ff.linear_in.sbT,denseT:t.ff.linear_in.denseT,outT:e,M:h,inFeatures:c,outFeatures:d*2}),await In(a,{xT:e,yT:me,rows:h,mlpInner:d})}if(t.ff_context.linear_in.denseT?.denseLayout===`k-out-vec4n`&&L.dtype===`float16`&&he.dtype===`float16`)await On(a,{aT:L,wT:t.ff_context.linear_in.denseT,outT:he,M:g,inFeatures:c,innerFeatures:d});else{let e=pe();await be({aT:L,q:Ce,bitsT:t.ff_context.linear_in.bitsT,sbT:t.ff_context.linear_in.sbT,denseT:t.ff_context.linear_in.denseT,outT:e,M:g,inFeatures:c,outFeatures:d*2}),await In(a,{xT:e,yT:he,rows:g,mlpInner:d})}t.ff.linear_out.denseT||await H({aT:me,q:Ee,M:h,inFeatures:d}),t.ff_context.linear_out.denseT||await H({aT:he,q:De,M:g,inFeatures:d}),await be({aT:me,q:Ee,bitsT:t.ff.linear_out.bitsT,sbT:t.ff.linear_out.sbT,denseT:t.ff.linear_out.denseT,outT:z,M:h,inFeatures:d,outFeatures:c}),await be({aT:he,q:De,bitsT:t.ff_context.linear_out.bitsT,sbT:t.ff_context.linear_out.sbT,denseT:t.ff_context.linear_out.denseT,outT:ge,M:g,inFeatures:d,outFeatures:c}),await Vr(a,{xT:N,addT:z,count:h*c,...V(_e,`mlp`),inner:c}),await Vr(a,{xT:P,addT:ge,count:g*c,...V(ve,`mlp`),inner:c})}let Oe=a.empty(S,[_,c],`combined`);await Br(a,{aT:P,bT:N,outT:Oe,aElems:g*c,totalElems:_*c});let ke=a.empty(S,[w,c],`s-norm`),Ae=a.empty(S,[w,o.fusedSingleOutRows],`s-fused`),je=a.empty(S,[_,c],`s-v`),Me=a.empty(S,[_,c],`s-q-norm`),Ne=a.empty(S,[_,c],`s-k-norm`),Pe=a.empty(S,[_,c],`s-attn`),Fe=a.empty(S,[_,d],`s-mlp-post`),Ie=a.empty(S,[w,c+d],`s-cat`),Le=a.empty(S,[w,c],`s-out`),Re=xe?Kn(a,{M:w,inFeatures:c,groupSize:m}):null,ze=xe?Kn(a,{M:w,inFeatures:c+d,groupSize:m}):null;for(let e=0;e<o.num_single_layers;++e){let t=s.single[e];await zr(a,{xT:Oe,yT:ke,rows:_,dim:c,eps:f,...ye(B,`msa`)}),t.attn.to_qkv_mlp_proj.denseT||await H({aT:ke,q:Re,M:w,inFeatures:c}),await be({aT:ke,q:Re,bitsT:t.attn.to_qkv_mlp_proj.bitsT,sbT:t.attn.to_qkv_mlp_proj.sbT,denseT:t.attn.to_qkv_mlp_proj.denseT,outT:Ae,M:w,inFeatures:c,outFeatures:o.fusedSingleOutRows}),await Hr(a,{srcT:Ae,dstT:je,rows:_,srcStride:o.fusedSingleOutRows,srcStart:2*c,dstStride:c,copyCols:c}),await Wr(a,{srcT:Ae,wT:t.attn.norm_q,cosT:F,sinT:I,yT:Me,seq:_,heads:l,headDim:u,srcStride:o.fusedSingleOutRows,srcStart:0,eps:f}),await Wr(a,{srcT:Ae,wT:t.attn.norm_k,cosT:F,sinT:I,yT:Ne,seq:_,heads:l,headDim:u,srcStride:o.fusedSingleOutRows,srcStart:c,eps:f}),await Wn(a,{qT:Me,kT:Ne,vT:je,outT:Pe,seq:_,qHeads:l,kvHeads:l,headDim:u,causal:!1}),await Ur(a,{srcT:Ae,yT:Fe,rows:_,srcStride:o.fusedSingleOutRows,srcStart:3*c,mlpInner:d}),await Gr(a,{aT:Pe,bT:Fe,outT:Ie,rows:_,aCols:c,bCols:d}),t.attn.to_out.denseT||await H({aT:Ie,q:ze,M:w,inFeatures:c+d}),await be({aT:Ie,q:ze,bitsT:t.attn.to_out.bitsT,sbT:t.attn.to_out.sbT,denseT:t.attn.to_out.denseT,outT:Le,M:w,inFeatures:c+d,outFeatures:c}),await Vr(a,{xT:Oe,addT:Le,count:_*c,...V(B,`msa`),inner:c})}let Be=a.empty(S,[h,c],`img-only`);await a.copyBufferToBuffer({src:Oe.buffer,dst:Be.buffer,srcOffset:g*c*C,byteLength:h*c*C});let Ve=a.empty(`float32`,[h,c],`final-normed`);await Kr(a,{xT:Be,yT:Ve,rows:h,dim:c,eps:f,tembT:O,normLinear:s.norm_out});let He=a.empty(`float32`,[h,o.out_channels],`noise-pred`);return await or(a,{aT:Ve,wT:s.proj_out.weight,bT:s.proj_out.bias,outT:He,M:h,inFeatures:c,outFeatures:o.out_channels}),He}};function Pr(e,t,n=1e4){let r=t/2,i=new Float32Array(t);for(let t=0;t<r;++t){let a=e*Math.exp(-Math.log(n)*t/r);i[t]=Math.cos(a),i[r+t]=Math.sin(a)}return i}function Fr(e,t,n,r){let i=n.length,a=0;for(let e of n)a+=e;let o=new Float32Array(t*a),s=new Float32Array(t*a),c=n.map(e=>{let t=e/2,n=new Float64Array(t);for(let i=0;i<t;++i)n[i]=1/r**(2*i/e);return n});for(let r=0;r<t;++r){let t=r*a,l=0;for(let a=0;a<i;++a){let u=e[r*i+a],d=c[a],f=n[a],p=f/2;for(let e=0;e<p;++e){let n=u*d[e],r=Math.fround(Math.cos(n)),i=Math.fround(Math.sin(n));o[t+l+2*e]=r,o[t+l+2*e+1]=r,s[t+l+2*e]=i,s[t+l+2*e+1]=i}l+=f}}return{cos:o,sin:s}}function Ir(e){let t=2166136261;for(let n=0;n<e.length;++n)t^=Math.trunc(e[n])+2654435769+(n<<6)+(n>>>2)>>>0,t=Math.imul(t,16777619)>>>0;return t.toString(16)}function Lr(e,t){return{t:e,msaShiftOffset:0,msaScaleOffset:t,msaGateOffset:2*t,mlpShiftOffset:3*t,mlpScaleOffset:4*t,mlpGateOffset:5*t}}function Rr(e,t){return{t:e,msaShiftOffset:0,msaScaleOffset:t,msaGateOffset:2*t}}async function zr(e,{xT:t,yT:n,rows:r,dim:i,eps:a,shift:o,scale:s,shiftT:c=null,scaleT:l=null,shiftOffset:u=0,scaleOffset:d=0}){let f=t.dtype,p=n.dtype,m=kr(f),h=kr(p),g=`lnmod_d${i}_e${a}_${f}_${p}`,_=`${Ar(f,p)}struct Params { rows: u32, shiftOffset: u32, scaleOffset: u32, _pad0: u32 };
@group(0) @binding(0) var<storage, read>       x: array<${m}>;
@group(0) @binding(1) var<storage, read>       shiftBuf: array<f32>;
@group(0) @binding(2) var<storage, read>       scaleBuf: array<f32>;
@group(0) @binding(3) var<storage, read_write> y: array<${h}>;
@group(0) @binding(4) var<uniform>             params: Params;
const DIM: u32 = ${i}u;
const EPS: f32 = ${a};
const WG: u32 = 64u;
var<workgroup> partial: array<f32, 64>;
var<workgroup> sum_acc: f32;
fn red(tid: u32) -> f32 {
  workgroupBarrier();
  var stride: u32 = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) { partial[tid] = partial[tid] + partial[tid + stride]; }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return partial[0];
}
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let r = wg.x; if (r >= params.rows) { return; }
  let tid = lid.x;
  let base = r * DIM;
  var s: f32 = 0.0;
  for (var i: u32 = tid; i < DIM; i = i + WG) { s = s + ${jr(`x[base + i]`,f)}; }
  partial[tid] = s;
  let mean = red(tid) / f32(DIM);
  var sq: f32 = 0.0;
  for (var i: u32 = tid; i < DIM; i = i + WG) {
    let d = ${jr(`x[base + i]`,f)} - mean;
    sq = sq + d * d;
  }
  partial[tid] = sq;
  let invStd = inverseSqrt(red(tid) / f32(DIM) + EPS);
  for (var i: u32 = tid; i < DIM; i = i + WG) {
    let normed_v = (${jr(`x[base + i]`,f)} - mean) * invStd;
    y[base + i] = ${Mr(`normed_v * (1.0 + scaleBuf[params.scaleOffset + i]) + shiftBuf[params.shiftOffset + i]`,p)};
  }
}
`,v=c??e.tensorFromTypedArray(`float32`,[i],o),y=l??e.tensorFromTypedArray(`float32`,[i],s),b=e.createUniformU32([r,u,d,0],`lnmod-params`);await e.runProgram({name:`lnmod`,source:_,cacheKey:g,bindings:[{tensor:t,type:`read-only-storage`},{tensor:v,type:`read-only-storage`},{tensor:y,type:`read-only-storage`},{tensor:n,type:`storage`},{buffer:b,type:`uniform`}],workgroups:[r,1,1]})}async function Br(e,{aT:t,bT:n,outT:r,aElems:i,totalElems:a}){await Gn(e,{aT:t,bT:n,outT:r,aElems:i,totalElems:a})}async function Vr(e,{xT:t,addT:n,count:r,gate:i,gateT:a=null,gateOffset:o=0,inner:s}){let c=t.dtype;if(c===`float16`&&n.dtype===`float16`&&r%4==0&&s%4==0&&o%4==0){let l=`gatedres_d${s}_${c}_v4`,u=a??e.tensorFromTypedArray(`float32`,[s],i),d=r/4,f=Math.ceil(d/64),p=Math.min(f,1024),m=Math.ceil(f/p),h=e.createUniformU32([d,s/4,p,o/4],`gatedres-v4-params`);await e.runProgram({name:`gatedres`,source:`enable f16;
struct Params { countV4: u32, periodV4: u32, wgY: u32, gateOffsetV4: u32 };
@group(0) @binding(0) var<storage, read_write> x: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read>       add: array<vec4<f16>>;
@group(0) @binding(2) var<storage, read>       g: array<vec4<f32>>;
@group(0) @binding(3) var<uniform>             params: Params;
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let i = wg_idx * 64u + lid.x;
  if (i >= params.countV4) { return; }
  let p = i % params.periodV4;
  let xv = vec4<f32>(x[i]);
  let av = vec4<f32>(add[i]);
  let gv = g[params.gateOffsetV4 + p];
  x[i] = vec4<f16>(xv + gv * av);
}
`,cacheKey:l,bindings:[{tensor:t,type:`storage`},{tensor:n,type:`read-only-storage`},{tensor:u,type:`read-only-storage`},{buffer:h,type:`uniform`}],workgroups:[p,m,1]});return}let l=kr(c),u=`gatedres_d${s}_${c}`,d=`${Ar(c)}struct Params { count: u32, period: u32, wgY: u32, gateOffset: u32 };
@group(0) @binding(0) var<storage, read_write> x: array<${l}>;
@group(0) @binding(1) var<storage, read>       add: array<${l}>;
@group(0) @binding(2) var<storage, read>       g: array<f32>;
@group(0) @binding(3) var<uniform>             params: Params;
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let i = wg_idx * 64u + lid.x;
  if (i >= params.count) { return; }
  let p = i % params.period;
  x[i] = ${Mr(`${jr(`x[i]`,c)} + g[params.gateOffset + p] * ${jr(`add[i]`,c)}`,c)};
}
`,f=a??e.tensorFromTypedArray(`float32`,[s],i),p=Math.ceil(r/64),m=Math.min(p,1024),h=Math.ceil(p/m),g=e.createUniformU32([r,s,m,o],`gatedres-params`);await e.runProgram({name:`gatedres`,source:d,cacheKey:u,bindings:[{tensor:t,type:`storage`},{tensor:n,type:`read-only-storage`},{tensor:f,type:`read-only-storage`},{buffer:g,type:`uniform`}],workgroups:[m,h,1]})}async function Hr(e,{srcT:t,dstT:n,rows:r,srcStride:i,srcStart:a,dstStride:o,copyCols:s}){let c=n.dtype;if(c===`float16`&&t.dtype===`float16`&&i%4==0&&a%4==0&&o%4==0&&s%4==0){let l=`slice_cols_${c}_v4`,u=new ArrayBuffer(32),d=new Uint32Array(u);d[0]=r,d[1]=s/4,d[2]=i/4,d[3]=a/4,d[4]=o/4,d[5]=0;let f=e.createUniformU32(new Uint32Array(u),`slice-v4-params`);await e.runProgram({name:`slice_cols`,source:`enable f16;
struct Params { rows: u32, copyColsV4: u32, srcStrideV4: u32, srcStartV4: u32, dstStrideV4: u32, dstStartV4: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       s: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read_write> d: array<vec4<f16>>;
@group(0) @binding(2) var<uniform>             p: Params;
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let r = wg.x; if (r >= p.rows) { return; }
  var i: u32 = lid.x;
  loop {
    if (i >= p.copyColsV4) { break; }
    d[r * p.dstStrideV4 + p.dstStartV4 + i] = s[r * p.srcStrideV4 + p.srcStartV4 + i];
    i = i + 64u;
  }
}
`,cacheKey:l,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`storage`},{buffer:f,type:`uniform`}],workgroups:[r,1,1]});return}let l=kr(c),u=`slice_cols_${c}`,d=`${Ar(c)}struct Params { rows: u32, copyCols: u32, srcStride: u32, srcStart: u32, dstStride: u32, dstStart: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       s: array<${l}>;
@group(0) @binding(1) var<storage, read_write> d: array<${l}>;
@group(0) @binding(2) var<uniform>             p: Params;
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let r = wg.x; if (r >= p.rows) { return; }
  var i: u32 = lid.x;
  loop {
    if (i >= p.copyCols) { break; }
    d[r * p.dstStride + p.dstStart + i] = s[r * p.srcStride + p.srcStart + i];
    i = i + 64u;
  }
}
`,f=new ArrayBuffer(32),p=new Uint32Array(f);p[0]=r,p[1]=s,p[2]=i,p[3]=a,p[4]=o,p[5]=0;let m=e.createUniformU32(new Uint32Array(f),`slice-params`);await e.runProgram({name:`slice_cols`,source:d,cacheKey:u,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`storage`},{buffer:m,type:`uniform`}],workgroups:[r,1,1]})}async function Ur(e,{srcT:t,yT:n,rows:r,srcStride:i,srcStart:a,mlpInner:o}){let s=t.dtype,c=n.dtype;if(s===`float16`&&c===`float16`&&i%4==0&&a%4==0&&o%4==0){let l=`swiglu_cols_${s}_${c}_v4`,u=e.createUniformU32([r,i/4,a/4,o/4],`swiglu-cols-v4-params`);await e.runProgram({name:`swiglu`,source:`enable f16;
struct Params { rows: u32, srcStrideV4: u32, srcStartV4: u32, mlpInnerV4: u32 };
@group(0) @binding(0) var<storage, read>       x: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read_write> y: array<vec4<f16>>;
@group(0) @binding(2) var<uniform>             p: Params;
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let r = wg.x;
  if (r >= p.rows) { return; }
  let i = wg.y * 64u + lid.x;
  if (i >= p.mlpInnerV4) { return; }
  let base = r * p.srcStrideV4 + p.srcStartV4 + i;
  let x1 = vec4<f32>(x[base]);
  let x2 = vec4<f32>(x[base + p.mlpInnerV4]);
  y[r * p.mlpInnerV4 + i] = vec4<f16>((x1 / (vec4<f32>(1.0) + exp(-x1))) * x2);
}
`,cacheKey:l,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`storage`},{buffer:u,type:`uniform`}],workgroups:[r,Math.ceil(o/4/64),1]});return}let l=kr(s),u=kr(c),d=`swiglu_cols_${s}_${c}`,f=`${Ar(s,c)}struct Params { rows: u32, srcStride: u32, srcStart: u32, mlpInner: u32 };
@group(0) @binding(0) var<storage, read>       x: array<${l}>;
@group(0) @binding(1) var<storage, read_write> y: array<${u}>;
@group(0) @binding(2) var<uniform>             p: Params;
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let r = wg.x;
  if (r >= p.rows) { return; }
  let i = wg.y * 64u + lid.x;
  if (i >= p.mlpInner) { return; }
  let base = r * p.srcStride + p.srcStart + i;
  let x1 = ${jr(`x[base]`,s)};
  let x2 = ${jr(`x[base + p.mlpInner]`,s)};
  y[r * p.mlpInner + i] = ${Mr(`(x1 / (1.0 + exp(-x1))) * x2`,c)};
}
`,p=e.createUniformU32([r,i,a,o],`swiglu-cols-params`);await e.runProgram({name:`swiglu`,source:f,cacheKey:d,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`storage`},{buffer:p,type:`uniform`}],workgroups:[r,Math.ceil(o/64),1]})}async function Wr(e,{srcT:t,wT:n,cosT:r,sinT:i,yT:a,seq:o,heads:s,headDim:c,srcStride:l,srcStart:u,dstRowOffset:d=0,eps:f}){if(c%2!=0)throw Error(`rmsNormRopeFromColumns requires even headDim`);let p=c/2;if(p>256)throw Error(`rmsNormRopeFromColumns headDim=${c} exceeds workgroup limit`);let m=t.dtype,h=n.dtype,g=a.dtype,_=kr(m),v=kr(h),y=kr(g),b=`rmsrope_cols_hd${c}_${m}_${h}_${g}`,x=`${Ar(m,h,g)}struct Params { seq: u32, heads: u32, srcStride: u32, srcStart: u32, dstRowOffset: u32, eps: f32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       x: array<${_}>;
@group(0) @binding(1) var<storage, read>       w: array<${v}>;
@group(0) @binding(2) var<storage, read>       cosTbl: array<f32>;
@group(0) @binding(3) var<storage, read>       sinTbl: array<f32>;
@group(0) @binding(4) var<storage, read_write> y: array<${y}>;
@group(0) @binding(5) var<uniform>             p: Params;

const HEAD_DIM: u32 = ${c}u;
const HALF_DIM: u32 = ${p}u;
const WG:       u32 = ${p}u;

var<workgroup> partial: array<f32, WG>;

@compute @workgroup_size(WG, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let t = wg.x;
  let h = wg.y;
  if (t >= p.seq || h >= p.heads) { return; }
  let tid = lid.x;
  let srcBase = t * p.srcStride + p.srcStart + h * HEAD_DIM;

  let a0 = ${jr(`x[srcBase + tid]`,m)};
  let a1 = ${jr(`x[srcBase + tid + HALF_DIM]`,m)};
  partial[tid] = a0 * a0 + a1 * a1;
  workgroupBarrier();
  var stride: u32 = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      partial[tid] = partial[tid] + partial[tid + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  let normScale = inverseSqrt(partial[0] / f32(HEAD_DIM) + p.eps);

  let idx = tid * 2u;
  let xe = ${jr(`x[srcBase + idx]`,m)} * normScale * ${jr(`w[idx]`,h)};
  let xo = ${jr(`x[srcBase + idx + 1u]`,m)} * normScale * ${jr(`w[idx + 1u]`,h)};
  let dstT = p.dstRowOffset + t;
  let tableBase = dstT * HEAD_DIM + idx;
  let c = cosTbl[tableBase];
  let s = sinTbl[tableBase];
  let outBase = (dstT * p.heads + h) * HEAD_DIM;
  y[outBase + idx] = ${Mr(`xe * c - xo * s`,g)};
  y[outBase + idx + 1u] = ${Mr(`xo * c + xe * s`,g)};
}
`,S=new ArrayBuffer(32),C=new Uint32Array(S),w=new Float32Array(S);C[0]=o,C[1]=s,C[2]=l,C[3]=u,C[4]=d,w[5]=f;let T=e.createUniformU32(new Uint32Array(S),`rmsrope-cols-params`);await e.runProgram({name:`rmsnorm_rope`,source:x,cacheKey:b,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`read-only-storage`},{tensor:i,type:`read-only-storage`},{tensor:a,type:`storage`},{buffer:T,type:`uniform`}],workgroups:[o,s,1]})}async function Gr(e,{aT:t,bT:n,outT:r,rows:i,aCols:a,bCols:o}){let s=r.dtype;if(s===`float16`&&t.dtype===`float16`&&n.dtype===`float16`&&a%4==0&&o%4==0){let c=`row_concat_${s}_v4`,l=e.createUniformU32([i,a/4,o/4,0],`rowconcat-v4-params`);await e.runProgram({name:`row_concat`,source:`enable f16;
struct Params { rows: u32, aColsV4: u32, bColsV4: u32, _pad0: u32 };
@group(0) @binding(0) var<storage, read>       a: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read>       b: array<vec4<f16>>;
@group(0) @binding(2) var<storage, read_write> o: array<vec4<f16>>;
@group(0) @binding(3) var<uniform>             p: Params;
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let r = wg.x; if (r >= p.rows) { return; }
  let outStride = p.aColsV4 + p.bColsV4;
  var i: u32 = lid.x;
  loop {
    if (i >= p.aColsV4) { break; }
    o[r * outStride + i] = a[r * p.aColsV4 + i];
    i = i + 64u;
  }
  i = lid.x;
  loop {
    if (i >= p.bColsV4) { break; }
    o[r * outStride + p.aColsV4 + i] = b[r * p.bColsV4 + i];
    i = i + 64u;
  }
}
`,cacheKey:c,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`storage`},{buffer:l,type:`uniform`}],workgroups:[i,1,1]});return}let c=kr(s),l=`row_concat_${s}`,u=`${Ar(s)}struct Params { rows: u32, aCols: u32, bCols: u32, _pad0: u32 };
@group(0) @binding(0) var<storage, read>       a: array<${c}>;
@group(0) @binding(1) var<storage, read>       b: array<${c}>;
@group(0) @binding(2) var<storage, read_write> o: array<${c}>;
@group(0) @binding(3) var<uniform>             p: Params;
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let r = wg.x; if (r >= p.rows) { return; }
  let outStride = p.aCols + p.bCols;
  var i: u32 = lid.x;
  loop {
    if (i >= p.aCols) { break; }
    o[r * outStride + i] = a[r * p.aCols + i];
    i = i + 64u;
  }
  i = lid.x;
  loop {
    if (i >= p.bCols) { break; }
    o[r * outStride + p.aCols + i] = b[r * p.bCols + i];
    i = i + 64u;
  }
}
`,d=e.createUniformU32([i,a,o,0],`rowconcat-params`);await e.runProgram({name:`row_concat`,source:u,cacheKey:l,bindings:[{tensor:t,type:`read-only-storage`},{tensor:n,type:`read-only-storage`},{tensor:r,type:`storage`},{buffer:d,type:`uniform`}],workgroups:[i,1,1]})}async function Kr(e,{xT:t,yT:n,rows:r,dim:i,eps:a,tembT:o,normLinear:s}){let c=e.empty(`float32`,[1,i],`ada-silu`);await e.copyBufferToBuffer({src:o.buffer,dst:c.buffer,byteLength:i*4}),await Fn(e,{xT:c,count:i});let l=e.empty(`float32`,[1,2*i],`ada-proj`);await or(e,{aT:c,wT:s.weight,bT:s.bias,outT:l,M:1,inFeatures:i,outFeatures:2*i});let u=await e.readTensor(l),d=u.slice(0,i);await zr(e,{xT:t,yT:n,rows:r,dim:i,eps:a,shift:u.slice(i,2*i),scale:d})}function U(e){return e===`float16`?`f16`:`f32`}function qr(...e){return e.includes(`float16`)?`enable f16;
`:``}function W(e,t){return t===`float16`?`f32(${e})`:e}function Jr(e,t){return t===`float16`?`f16(${e})`:e}function Yr({inC:e,outC:t,H:n,W:r,kH:i,kW:a,pad:o,hasBias:s,inputDtype:c=`float32`,weightDtype:l=`float32`,biasDtype:u=`float32`,outputDtype:d=`float32`}){let f=U(c),p=U(l),m=U(u),h=U(d);return`${qr(c,l,u,d)}struct Params { _pad0: u32, _pad1: u32, _pad2: u32, _pad3: u32 };
@group(0) @binding(0) var<storage, read>       input: array<${f}>;
@group(0) @binding(1) var<storage, read>       weight: array<${p}>;
${s?`@group(0) @binding(2) var<storage, read>       bias: array<${m}>;
`:``}@group(0) @binding(${s?3:2}) var<storage, read_write> output: array<${h}>;

const IN_C: u32 = ${e}u;
const OUT_C: u32 = ${t}u;
const H: u32 = ${n}u;
const W: u32 = ${r}u;
const KH: i32 = ${i};
const KW: i32 = ${a};
const PAD: i32 = ${o};

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let y = gid.x;
  let x = gid.y;
  let oc = gid.z;
  if (y >= H || x >= W || oc >= OUT_C) { return; }

  var acc: f32 = ${s?W(`bias[oc]`,u):`0.0`};
  let oc_base = oc * IN_C * u32(KH * KW);
  for (var ic: u32 = 0u; ic < IN_C; ic = ic + 1u) {
    let ic_w_base = oc_base + ic * u32(KH * KW);
    let ic_in_base = ic * H * W;
    for (var kh: i32 = 0; kh < KH; kh = kh + 1) {
      let iy: i32 = i32(y) + kh - PAD;
      if (iy < 0 || iy >= i32(H)) { continue; }
      for (var kw: i32 = 0; kw < KW; kw = kw + 1) {
        let ix: i32 = i32(x) + kw - PAD;
        if (ix < 0 || ix >= i32(W)) { continue; }
        let w_idx = ic_w_base + u32(kh) * u32(KW) + u32(kw);
        let in_idx = ic_in_base + u32(iy) * W + u32(ix);
        acc = acc + ${W(`input[in_idx]`,c)} * ${W(`weight[w_idx]`,l)};
      }
    }
  }
  output[oc * H * W + y * W + x] = ${Jr(`acc`,d)};
}
`}function Xr({inC:e,outC:t,H:n,W:r,kH:i,kW:a,pad:o,hasBias:s,outTile:c=4,inputDtype:l=`float32`,weightDtype:u=`float32`,biasDtype:d=`float32`,outputDtype:f=`float32`}){if(t%c!==0)throw Error(`outC must be divisible by outTile`);let p=U(l),m=U(u),h=U(d),g=U(f),_=[],v=[],y=[];for(let e=0;e<c;++e)_.push(`  var acc${e}: f32 = ${s?W(`bias[oc_base + ${e}u]`,d):`0.0`};`),v.push(`        acc${e} = acc${e} + in_val * ${W(`weight[(oc_base + ${e}u) * OC_STRIDE + k_offset]`,u)};`),y.push(`  output[(oc_base + ${e}u) * H * W + y * W + x] = ${Jr(`acc${e}`,f)};`);return`${qr(l,u,d,f)}struct Params { _pad0: u32, _pad1: u32, _pad2: u32, _pad3: u32 };
@group(0) @binding(0) var<storage, read>       input: array<${p}>;
@group(0) @binding(1) var<storage, read>       weight: array<${m}>;
${s?`@group(0) @binding(2) var<storage, read>       bias: array<${h}>;
`:``}@group(0) @binding(${s?3:2}) var<storage, read_write> output: array<${g}>;

const IN_C: u32 = ${e}u;
const OUT_C: u32 = ${t}u;
const H: u32 = ${n}u;
const W: u32 = ${r}u;
const KH: i32 = ${i};
const KW: i32 = ${a};
const PAD: i32 = ${o};
const OUT_TILE: u32 = ${c}u;
const K_PER_IC: u32 = ${i*a}u;
const OC_STRIDE: u32 = ${e*i*a}u;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let y = gid.x;
  let x = gid.y;
  let oc_base = gid.z * OUT_TILE;
  if (y >= H || x >= W || oc_base >= OUT_C) { return; }

${_.join(`
`)}
  for (var ic: u32 = 0u; ic < IN_C; ic = ic + 1u) {
    let ic_in_base = ic * H * W;
    for (var kh: i32 = 0; kh < KH; kh = kh + 1) {
      let iy: i32 = i32(y) + kh - PAD;
      if (iy < 0 || iy >= i32(H)) { continue; }
      for (var kw: i32 = 0; kw < KW; kw = kw + 1) {
        let ix: i32 = i32(x) + kw - PAD;
        if (ix < 0 || ix >= i32(W)) { continue; }
        let k_offset = ic * K_PER_IC + u32(kh) * u32(KW) + u32(kw);
        let in_val = ${W(`input[ic_in_base + u32(iy) * W + u32(ix)]`,l)};
${v.join(`
`)}
      }
    }
  }
${y.join(`
`)}
}
`}function Zr({inC:e,outC:t,H:n,W:r,hasBias:i,outTile:a=16,icTile:o=16,inputDtype:s=`float32`,weightDtype:c=`float32`,biasDtype:l=`float32`,outputDtype:u=`float32`}){if(t%a!==0)throw Error(`outC must be divisible by outTile`);let d=c===`float16`?`float16`:`float32`,f=d===`float16`?2:4;if(a*o*9*f>16*1024)throw Error(`conv shared-weight tile exceeds 16KB workgroup storage`);let p=U(s),m=U(c),h=U(d),g=U(l),_=U(u),v=a*o*9,y=[],b=[],x=[];for(let e=0;e<a;++e){y.push(`  var acc${e}: f32 = ${i?W(`bias[oc_base + ${e}u]`,l):`0.0`};`);for(let t=0;t<9;++t)b.push(`      acc${e} = acc${e} + v${t} * ${W(`wTile[${e*o*9}u + li * 9u + ${t}u]`,d)};`);x.push(`    output[(oc_base + ${e}u) * H * W + y * W + x] = ${Jr(`acc${e}`,u)};`)}return`${qr(s,c,l,u)}struct Params { _pad0: u32, _pad1: u32, _pad2: u32, _pad3: u32 };
@group(0) @binding(0) var<storage, read>       input: array<${p}>;
@group(0) @binding(1) var<storage, read>       weight: array<${m}>;
${i?`@group(0) @binding(2) var<storage, read>       bias: array<${g}>;
`:``}@group(0) @binding(${i?3:2}) var<storage, read_write> output: array<${_}>;

const IN_C: u32 = ${e}u;
const OUT_C: u32 = ${t}u;
const H: u32 = ${n}u;
const W: u32 = ${r}u;
const OUT_TILE: u32 = ${a}u;
const IC_TILE: u32 = ${o}u;
const OC_STRIDE: u32 = ${e*9}u;
const WTILE_ELEMS: u32 = ${v}u;

var<workgroup> wTile: array<${h}, ${v}>;

fn loadInput(ic: u32, iy: i32, ix: i32) -> f32 {
  if (iy < 0 || iy >= i32(H) || ix < 0 || ix >= i32(W)) {
    return 0.0;
  }
  return ${W(`input[ic * H * W + u32(iy) * W + u32(ix)]`,s)};
}

@compute @workgroup_size(8, 8, 1)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_index) local_idx: u32
) {
  let y = gid.x;
  let x = gid.y;
  let oc_base = gid.z * OUT_TILE;
  let isActive = y < H && x < W && oc_base < OUT_C;

${y.join(`
`)}
  for (var ic_base: u32 = 0u; ic_base < IN_C; ic_base = ic_base + IC_TILE) {
    let tile_count = min(IC_TILE, IN_C - ic_base);
    for (var wi: u32 = local_idx; wi < WTILE_ELEMS; wi = wi + 64u) {
      let tile_oc = wi / (IC_TILE * 9u);
      let rem0 = wi - tile_oc * IC_TILE * 9u;
      let tile_ic = rem0 / 9u;
      let tap = rem0 - tile_ic * 9u;
      if (tile_ic < tile_count) {
        wTile[wi] = weight[(oc_base + tile_oc) * OC_STRIDE + (ic_base + tile_ic) * 9u + tap];
      } else {
        wTile[wi] = ${d===`float16`?`0.0h`:`0.0`};
      }
    }
    workgroupBarrier();

    for (var li: u32 = 0u; li < tile_count; li = li + 1u) {
      let ic = ic_base + li;
      var v0: f32;
      var v1: f32;
      var v2: f32;
      var v3: f32;
      var v4: f32;
      var v5: f32;
      var v6: f32;
      var v7: f32;
      var v8: f32;
      if (y > 0u && y + 1u < H && x > 0u && x + 1u < W) {
        let base0 = ic * H * W + (y - 1u) * W + x - 1u;
        let base1 = base0 + W;
        let base2 = base1 + W;
        v0 = ${W(`input[base0]`,s)};
        v1 = ${W(`input[base0 + 1u]`,s)};
        v2 = ${W(`input[base0 + 2u]`,s)};
        v3 = ${W(`input[base1]`,s)};
        v4 = ${W(`input[base1 + 1u]`,s)};
        v5 = ${W(`input[base1 + 2u]`,s)};
        v6 = ${W(`input[base2]`,s)};
        v7 = ${W(`input[base2 + 1u]`,s)};
        v8 = ${W(`input[base2 + 2u]`,s)};
      } else {
        let iy = i32(y);
        let ix = i32(x);
        v0 = loadInput(ic, iy - 1, ix - 1);
        v1 = loadInput(ic, iy - 1, ix);
        v2 = loadInput(ic, iy - 1, ix + 1);
        v3 = loadInput(ic, iy, ix - 1);
        v4 = loadInput(ic, iy, ix);
        v5 = loadInput(ic, iy, ix + 1);
        v6 = loadInput(ic, iy + 1, ix - 1);
        v7 = loadInput(ic, iy + 1, ix);
        v8 = loadInput(ic, iy + 1, ix + 1);
      }
${b.join(`
`)}
    }
    workgroupBarrier();
  }
  if (isActive) {
${x.join(`
`)}
  }
}
`}function Qr({inC:e,outC:t,H:n,W:r,hasBias:i,hasAdd:a=!1,inputDtype:o=`float16`,weightDtype:s=`float16`,biasDtype:c=`float16`,outputDtype:l=`float16`,residualDtype:u=`float16`,mTile:d=32,nTile:f=16,rowPerThread:p=4,kTile:m=64,accumDtype:h=`float16`}){if(o!==`float16`||s!==`float16`||l!==`float16`)throw Error(`packed 3x3 conv requires f16 input/weight/output`);if(a&&u!==`float16`)throw Error(`packed 3x3 conv fused add requires f16 residual`);if(t%4!=0||m%4!=0||d%p!==0)throw Error(`invalid packed 3x3 conv tile`);if(h!==`float16`&&h!==`float32`)throw Error(`invalid packed 3x3 conv accum dtype`);let g=f,_=d/p,v=g*_;if(v>256)throw Error(`packed 3x3 conv exceeds max workgroup invocations`);let y=e*9,b=m/4;if((d*b+m*g)*8>16*1024)throw Error(`packed 3x3 conv exceeds 16KB workgroup storage`);let x=t%(f*4)==0,S=y%m===0,C=h===`float32`,w=C?`f32`:`f16`,T=U(c),E=i?3:2,D=E+ +!!a,O=e=>i?C?`f32(bias[n_group * 4u + ${e}u])`:`bias[n_group * 4u + ${e}u]`:C?`0.0`:`0.0h`,k=Array.from({length:p},(e,t)=>`  var acc${t}: vec4<${w}> = vec4<${w}>(${O(0)}, ${O(1)}, ${O(2)}, ${O(3)});`).join(`
`),A=Array.from({length:p},(e,t)=>C?`        let a${t} = aTile[(row_base + ${t}u) * K_TILE_V4 + kv];
        acc${t} = acc${t} + vec4<f32>(b0) * f32(a${t}.x) + vec4<f32>(b1) * f32(a${t}.y) + vec4<f32>(b2) * f32(a${t}.z) + vec4<f32>(b3) * f32(a${t}.w);`:`        let a${t} = aTile[(row_base + ${t}u) * K_TILE_V4 + kv];
        acc${t} = acc${t} + b0 * a${t}.x + b1 * a${t}.y + b2 * a${t}.z + b3 * a${t}.w;`).join(`
`),j=Array.from({length:p},(e,t)=>{let n=C?`vec4<f16>(acc${t})`:`acc${t}`;return`  if (${x?`m_base + ${t}u < HW`:`n_group < OUT_C_V4 && m_base + ${t}u < HW`}) {
    let m${t} = m_base + ${t}u;
    let oc${t} = n_group * 4u;
    let v${t} = ${n};
    let idx${t}0 = (oc${t} + 0u) * HW + m${t};
    let idx${t}1 = (oc${t} + 1u) * HW + m${t};
    let idx${t}2 = (oc${t} + 2u) * HW + m${t};
    let idx${t}3 = (oc${t} + 3u) * HW + m${t};
    output[idx${t}0] = v${t}.x${a?` + residual[idx${t}0]`:``};
    output[idx${t}1] = v${t}.y${a?` + residual[idx${t}1]`:``};
    output[idx${t}2] = v${t}.z${a?` + residual[idx${t}2]`:``};
    output[idx${t}3] = v${t}.w${a?` + residual[idx${t}3]`:``};
  }`}).join(`
`),M=S&&x?`      bTile[i] = weight[(k_base + kk) * OUT_C_V4 + bg];`:S?`      if (bg < OUT_C_V4) { bTile[i] = weight[(k_base + kk) * OUT_C_V4 + bg]; }
      else { bTile[i] = vec4<f16>(0.0h); }`:x?`      if (k_base + kk < K_TOTAL) { bTile[i] = weight[(k_base + kk) * OUT_C_V4 + bg]; }
      else { bTile[i] = vec4<f16>(0.0h); }`:`      if (k_base + kk < K_TOTAL && bg < OUT_C_V4) { bTile[i] = weight[(k_base + kk) * OUT_C_V4 + bg]; }
      else { bTile[i] = vec4<f16>(0.0h); }`,N=S?`fn loadIm2col(m: u32, k: u32) -> f16 {
  if (m >= HW) { return 0.0h; }
  let ic = k / 9u;
  let tap = k - ic * 9u;
  let kh = tap / 3u;
  let kw = tap - kh * 3u;
  let y = m / W;
  let x = m - y * W;
  if (y > 0u && y + 1u < H && x > 0u && x + 1u < W) {
    return input[ic * HW + (y + kh - 1u) * W + (x + kw - 1u)];
  }
  let iy = i32(y) + i32(kh) - 1;
  let ix = i32(x) + i32(kw) - 1;
  if (iy < 0 || iy >= i32(H) || ix < 0 || ix >= i32(W)) { return 0.0h; }
  return input[ic * HW + u32(iy) * W + u32(ix)];
}`:`fn loadIm2col(m: u32, k: u32) -> f16 {
  if (m >= HW || k >= K_TOTAL) { return 0.0h; }
  let ic = k / 9u;
  let tap = k - ic * 9u;
  let kh = tap / 3u;
  let kw = tap - kh * 3u;
  let y = m / W;
  let x = m - y * W;
  if (y > 0u && y + 1u < H && x > 0u && x + 1u < W) {
    return input[ic * HW + (y + kh - 1u) * W + (x + kw - 1u)];
  }
  let iy = i32(y) + i32(kh) - 1;
  let ix = i32(x) + i32(kw) - 1;
  if (iy < 0 || iy >= i32(H) || ix < 0 || ix >= i32(W)) { return 0.0h; }
  return input[ic * HW + u32(iy) * W + u32(ix)];
}`;return`enable f16;
@group(0) @binding(0) var<storage, read>       input: array<f16>;
@group(0) @binding(1) var<storage, read>       weight: array<vec4<f16>>;
${i?`@group(0) @binding(2) var<storage, read>       bias: array<${T}>;
`:``}${a?`@group(0) @binding(${E}) var<storage, read>       residual: array<f16>;
`:``}@group(0) @binding(${D}) var<storage, read_write> output: array<f16>;

const OUT_C_V4: u32 = ${t/4}u;
const H: u32 = ${n}u;
const W: u32 = ${r}u;
const HW: u32 = ${n*r}u;
const K_TOTAL: u32 = ${y}u;
const M_TILE: u32 = ${d}u;
const WG_X: u32 = ${g}u;
const ROW_PER_THREAD: u32 = ${p}u;
const K_TILE: u32 = ${m}u;
const K_TILE_V4: u32 = ${b}u;
const WG: u32 = ${v}u;

var<workgroup> aTile: array<vec4<f16>, ${d*b}>;
var<workgroup> bTile: array<vec4<f16>, ${m*g}>;

${N}

@compute @workgroup_size(${g}, ${_}, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let lx = lid.x;
  let ly = lid.y;
  let tid = ly * WG_X + lx;
  let row_base = ly * ROW_PER_THREAD;
  let m_base = wg.y * M_TILE + row_base;
  let n_group = wg.x * WG_X + lx;
${k}
  for (var k_base: u32 = 0u; k_base < K_TOTAL; k_base = k_base + K_TILE) {
    for (var i: u32 = tid; i < ${d*b}u; i = i + WG) {
      let tm = i / K_TILE_V4;
      let kv = i - tm * K_TILE_V4;
      let m = wg.y * M_TILE + tm;
      let k0 = k_base + kv * 4u;
      aTile[i] = vec4<f16>(loadIm2col(m, k0 + 0u), loadIm2col(m, k0 + 1u), loadIm2col(m, k0 + 2u), loadIm2col(m, k0 + 3u));
    }
    for (var i: u32 = tid; i < ${m*g}u; i = i + WG) {
      let kk = i / WG_X;
      let nx = i - kk * WG_X;
      let bg = wg.x * WG_X + nx;
${M}
    }
    workgroupBarrier();
    if (m_base < HW) {
      for (var kv: u32 = 0u; kv < K_TILE_V4; kv = kv + 1u) {
        let b0 = bTile[(kv * 4u + 0u) * WG_X + lx];
        let b1 = bTile[(kv * 4u + 1u) * WG_X + lx];
        let b2 = bTile[(kv * 4u + 2u) * WG_X + lx];
        let b3 = bTile[(kv * 4u + 3u) * WG_X + lx];
${A}
      }
    }
    workgroupBarrier();
  }
${j}
}
`}function $r({inC:e,outC:t,H:n,W:r,hasBias:i,hasAdd:a=!1,inputDtype:o=`float16`,weightDtype:s=`float16`,biasDtype:c=`float16`,outputDtype:l=`float16`,residualDtype:u=`float16`,mTile:d=32,nTile:f=8,kTile:p=8}){if(o!==`float16`||s!==`float16`||l!==`float16`)throw Error(`winograd 3x3 conv requires f16 input/weight/output`);if(a&&u!==`float16`)throw Error(`winograd 3x3 conv fused add requires f16 residual`);if(t%4!=0||e%p!==0)throw Error(`invalid winograd 3x3 conv shape`);let m=f,h=d,g=m*h;if(g>256)throw Error(`winograd 3x3 conv exceeds max workgroup invocations`);let _=d*p*16,v=p*16*f;if(_*2+v*8>16*1024)throw Error(`winograd 3x3 conv exceeds 16KB workgroup storage`);let y=Math.ceil(r/2),b=y*Math.ceil(n/2),x=t%(f*4)==0,S=U(c),C=i?3:2,w=C+ +!!a,T=i?`vec4<f16>(
    ${c===`float16`?`bias[n_group * 4u + 0u]`:`f16(bias[n_group * 4u + 0u])`},
    ${c===`float16`?`bias[n_group * 4u + 1u]`:`f16(bias[n_group * 4u + 1u])`},
    ${c===`float16`?`bias[n_group * 4u + 2u]`:`f16(bias[n_group * 4u + 2u])`},
    ${c===`float16`?`bias[n_group * 4u + 3u]`:`f16(bias[n_group * 4u + 3u])`})`:`vec4<f16>(0.0h)`,E=Array.from({length:16},(e,t)=>`  var acc${t}: vec4<f16> = vec4<f16>(0.0h);`).join(`
`),D=Array.from({length:16},(e,t)=>`        acc${t} = fma(bTile[(kk * 16u + ${t}u) * WG_X + lx], vec4<f16>(aTile[(tile_local * K_TILE + kk) * 16u + ${t}u]), acc${t});`).join(`
`),O=x?`if (tile_global >= TILES_TOTAL) { return; }`:`if (tile_global >= TILES_TOTAL || n_group >= OUT_C_V4) { return; }`,k=x?`      bTile[i] = weight[(ic * 16u + alpha) * OUT_C_V4 + bg];`:`      if (bg < OUT_C_V4) { bTile[i] = weight[(ic * 16u + alpha) * OUT_C_V4 + bg]; }
      else { bTile[i] = vec4<f16>(0.0h); }`;return`enable f16;
@group(0) @binding(0) var<storage, read>       input: array<f16>;
@group(0) @binding(1) var<storage, read>       weight: array<vec4<f16>>;
${i?`@group(0) @binding(2) var<storage, read>       bias: array<${S}>;
`:``}${a?`@group(0) @binding(${C}) var<storage, read>       residual: array<f16>;
`:``}@group(0) @binding(${w}) var<storage, read_write> output: array<f16>;

const IN_C: u32 = ${e}u;
const OUT_C_V4: u32 = ${t/4}u;
const H: u32 = ${n}u;
const W: u32 = ${r}u;
const HW: u32 = ${n*r}u;
const TILES_X: u32 = ${y}u;
const TILES_TOTAL: u32 = ${b}u;
const M_TILE: u32 = ${d}u;
const WG_X: u32 = ${m}u;
const WG_Y: u32 = ${h}u;
const WG: u32 = ${g}u;
const K_TILE: u32 = ${p}u;

var<workgroup> aTile: array<f16, ${_}>;
var<workgroup> bTile: array<vec4<f16>, ${v}>;

fn loadOne(ic: u32, y: i32, x: i32) -> f16 {
  if (y < 0 || y >= i32(H) || x < 0 || x >= i32(W)) {
    return 0.0h;
  }
  return input[ic * HW + u32(y) * W + u32(x)];
}

fn writeInputTransform(tile_global: u32, ic: u32, dst: u32) {
  if (tile_global >= TILES_TOTAL || ic >= IN_C) {
    for (var i: u32 = 0u; i < 16u; i = i + 1u) {
      aTile[dst + i] = 0.0h;
    }
    return;
  }

  let ty = tile_global / TILES_X;
  let tx = tile_global - ty * TILES_X;
  let oy = i32(ty * 2u);
  let ox = i32(tx * 2u);

  let d00 = loadOne(ic, oy - 1, ox - 1);
  let d01 = loadOne(ic, oy - 1, ox + 0);
  let d02 = loadOne(ic, oy - 1, ox + 1);
  let d03 = loadOne(ic, oy - 1, ox + 2);
  let d10 = loadOne(ic, oy + 0, ox - 1);
  let d11 = loadOne(ic, oy + 0, ox + 0);
  let d12 = loadOne(ic, oy + 0, ox + 1);
  let d13 = loadOne(ic, oy + 0, ox + 2);
  let d20 = loadOne(ic, oy + 1, ox - 1);
  let d21 = loadOne(ic, oy + 1, ox + 0);
  let d22 = loadOne(ic, oy + 1, ox + 1);
  let d23 = loadOne(ic, oy + 1, ox + 2);
  let d30 = loadOne(ic, oy + 2, ox - 1);
  let d31 = loadOne(ic, oy + 2, ox + 0);
  let d32 = loadOne(ic, oy + 2, ox + 1);
  let d33 = loadOne(ic, oy + 2, ox + 2);

  let t00 = d00 - d20;
  let t01 = d01 - d21;
  let t02 = d02 - d22;
  let t03 = d03 - d23;
  let t10 = d10 + d20;
  let t11 = d11 + d21;
  let t12 = d12 + d22;
  let t13 = d13 + d23;
  let t20 = d20 - d10;
  let t21 = d21 - d11;
  let t22 = d22 - d12;
  let t23 = d23 - d13;
  let t30 = d10 - d30;
  let t31 = d11 - d31;
  let t32 = d12 - d32;
  let t33 = d13 - d33;

  aTile[dst + 0u] = t00 - t02;
  aTile[dst + 1u] = t01 + t02;
  aTile[dst + 2u] = t02 - t01;
  aTile[dst + 3u] = t01 - t03;
  aTile[dst + 4u] = t10 - t12;
  aTile[dst + 5u] = t11 + t12;
  aTile[dst + 6u] = t12 - t11;
  aTile[dst + 7u] = t11 - t13;
  aTile[dst + 8u] = t20 - t22;
  aTile[dst + 9u] = t21 + t22;
  aTile[dst + 10u] = t22 - t21;
  aTile[dst + 11u] = t21 - t23;
  aTile[dst + 12u] = t30 - t32;
  aTile[dst + 13u] = t31 + t32;
  aTile[dst + 14u] = t32 - t31;
  aTile[dst + 15u] = t31 - t33;
}

fn storeOutput(tile_global: u32, n_group: u32,
  y00: vec4<f16>, y01: vec4<f16>, y10: vec4<f16>, y11: vec4<f16>) {
  ${O}
  let ty = tile_global / TILES_X;
  let tx = tile_global - ty * TILES_X;
  let oy = ty * 2u;
  let ox = tx * 2u;
  let oc = n_group * 4u;

  if (oy < H && ox < W) {
    let idx = oy * W + ox;
    output[(oc + 0u) * HW + idx] = y00.x${a?` + residual[(oc + 0u) * HW + idx]`:``};
    output[(oc + 1u) * HW + idx] = y00.y${a?` + residual[(oc + 1u) * HW + idx]`:``};
    output[(oc + 2u) * HW + idx] = y00.z${a?` + residual[(oc + 2u) * HW + idx]`:``};
    output[(oc + 3u) * HW + idx] = y00.w${a?` + residual[(oc + 3u) * HW + idx]`:``};
  }
  if (oy < H && ox + 1u < W) {
    let idx = oy * W + ox + 1u;
    output[(oc + 0u) * HW + idx] = y01.x${a?` + residual[(oc + 0u) * HW + idx]`:``};
    output[(oc + 1u) * HW + idx] = y01.y${a?` + residual[(oc + 1u) * HW + idx]`:``};
    output[(oc + 2u) * HW + idx] = y01.z${a?` + residual[(oc + 2u) * HW + idx]`:``};
    output[(oc + 3u) * HW + idx] = y01.w${a?` + residual[(oc + 3u) * HW + idx]`:``};
  }
  if (oy + 1u < H && ox < W) {
    let idx = (oy + 1u) * W + ox;
    output[(oc + 0u) * HW + idx] = y10.x${a?` + residual[(oc + 0u) * HW + idx]`:``};
    output[(oc + 1u) * HW + idx] = y10.y${a?` + residual[(oc + 1u) * HW + idx]`:``};
    output[(oc + 2u) * HW + idx] = y10.z${a?` + residual[(oc + 2u) * HW + idx]`:``};
    output[(oc + 3u) * HW + idx] = y10.w${a?` + residual[(oc + 3u) * HW + idx]`:``};
  }
  if (oy + 1u < H && ox + 1u < W) {
    let idx = (oy + 1u) * W + ox + 1u;
    output[(oc + 0u) * HW + idx] = y11.x${a?` + residual[(oc + 0u) * HW + idx]`:``};
    output[(oc + 1u) * HW + idx] = y11.y${a?` + residual[(oc + 1u) * HW + idx]`:``};
    output[(oc + 2u) * HW + idx] = y11.z${a?` + residual[(oc + 2u) * HW + idx]`:``};
    output[(oc + 3u) * HW + idx] = y11.w${a?` + residual[(oc + 3u) * HW + idx]`:``};
  }
}

@compute @workgroup_size(${m}, ${h}, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let lx = lid.x;
  let ly = lid.y;
  let tid = ly * WG_X + lx;
  let tile_local = ly;
  let tile_global = wg.y * M_TILE + tile_local;
  let n_group = wg.x * WG_X + lx;
${E}

  for (var k_base: u32 = 0u; k_base < IN_C; k_base = k_base + K_TILE) {
    for (var i: u32 = tid; i < ${d*p}u; i = i + WG) {
      let tm = i / K_TILE;
      let kk = i - tm * K_TILE;
      writeInputTransform(wg.y * M_TILE + tm, k_base + kk, i * 16u);
    }
    for (var i: u32 = tid; i < ${v}u; i = i + WG) {
      let ka = i / WG_X;
      let nx = i - ka * WG_X;
      let kk = ka / 16u;
      let alpha = ka - kk * 16u;
      let ic = k_base + kk;
      let bg = wg.x * WG_X + nx;
${k}
    }
    workgroupBarrier();

    if (${x?`tile_global < TILES_TOTAL`:`tile_global < TILES_TOTAL && n_group < OUT_C_V4`}) {
      for (var kk: u32 = 0u; kk < K_TILE; kk = kk + 1u) {
${D}
      }
    }
    workgroupBarrier();
  }

  let b = ${T};
  let s00 = acc0 + acc4 + acc8;
  let s01 = acc1 + acc5 + acc9;
  let s02 = acc2 + acc6 + acc10;
  let s03 = acc3 + acc7 + acc11;
  let s10 = acc4 - acc8 - acc12;
  let s11 = acc5 - acc9 - acc13;
  let s12 = acc6 - acc10 - acc14;
  let s13 = acc7 - acc11 - acc15;
  storeOutput(tile_global, n_group, s00 + s01 + s02 + b, s01 - s02 - s03 + b, s10 + s11 + s12 + b, s11 - s12 - s13 + b);
}
`}function ei({inC:e,outC:t}){if(t%4!=0)throw Error(`winograd weight transform requires outC divisible by 4`);return`enable f16;
@group(0) @binding(0) var<storage, read>       weight: array<f16>;
@group(0) @binding(1) var<storage, read_write> packed: array<f16>;

const IN_C: u32 = ${e}u;
const OUT_C: u32 = ${t}u;

fn store(ic: u32, oc: u32, alpha: u32, value: f32) {
  packed[(ic * 16u + alpha) * OUT_C + oc] = f16(value);
}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let oc = gid.x;
  let ic = gid.y;
  if (oc >= OUT_C || ic >= IN_C) { return; }

  let base = oc * IN_C * 9u + ic * 9u;
  let g00 = f32(weight[base + 0u]);
  let g01 = f32(weight[base + 1u]);
  let g02 = f32(weight[base + 2u]);
  let g10 = f32(weight[base + 3u]);
  let g11 = f32(weight[base + 4u]);
  let g12 = f32(weight[base + 5u]);
  let g20 = f32(weight[base + 6u]);
  let g21 = f32(weight[base + 7u]);
  let g22 = f32(weight[base + 8u]);

  let t00 = g00;
  let t01 = g01;
  let t02 = g02;
  let t10 = 0.5 * (g00 + g10 + g20);
  let t11 = 0.5 * (g01 + g11 + g21);
  let t12 = 0.5 * (g02 + g12 + g22);
  let t20 = 0.5 * (g00 - g10 + g20);
  let t21 = 0.5 * (g01 - g11 + g21);
  let t22 = 0.5 * (g02 - g12 + g22);
  let t30 = g20;
  let t31 = g21;
  let t32 = g22;

  store(ic, oc, 0u, t00);
  store(ic, oc, 1u, 0.5 * (t00 + t01 + t02));
  store(ic, oc, 2u, 0.5 * (t00 - t01 + t02));
  store(ic, oc, 3u, t02);
  store(ic, oc, 4u, t10);
  store(ic, oc, 5u, 0.5 * (t10 + t11 + t12));
  store(ic, oc, 6u, 0.5 * (t10 - t11 + t12));
  store(ic, oc, 7u, t12);
  store(ic, oc, 8u, t20);
  store(ic, oc, 9u, 0.5 * (t20 + t21 + t22));
  store(ic, oc, 10u, 0.5 * (t20 - t21 + t22));
  store(ic, oc, 11u, t22);
  store(ic, oc, 12u, t30);
  store(ic, oc, 13u, 0.5 * (t30 + t31 + t32));
  store(ic, oc, 14u, 0.5 * (t30 - t31 + t32));
  store(ic, oc, 15u, t32);
}
`}function ti({inC:e,outC:t,H:n,W:r,hasBias:i,hasAdd:a=!1,inputDtype:o=`float16`,weightDtype:s=`float16`,biasDtype:c=`float16`,outputDtype:l=`float16`,residualDtype:u=`float16`,mTile:d=112,nTile:f=16,rowPerThread:p=14,kTile:m=32,accumDtype:h=`float16`}){if(o!==`float16`||s!==`float16`||l!==`float16`)throw Error(`packed 1x1 conv requires f16 input/weight/output`);if(a&&u!==`float16`)throw Error(`packed 1x1 conv fused add requires f16 residual`);if(t%4!=0||e%4!=0||m%4!=0||d%p!==0)throw Error(`invalid packed 1x1 conv tile`);if(h!==`float16`&&h!==`float32`)throw Error(`invalid packed 1x1 conv accum dtype`);let g=f,_=d/p,v=g*_;if(v>256)throw Error(`packed 1x1 conv exceeds max workgroup invocations`);let y=m/4;if((d*y+m*g)*8>16*1024)throw Error(`packed 1x1 conv exceeds 16KB workgroup storage`);let b=t%(f*4)==0,x=e%m===0,S=h===`float32`,C=S?`f32`:`f16`,w=U(c),T=i?3:2,E=T+ +!!a,D=e=>i?S?`f32(bias[n_group * 4u + ${e}u])`:`bias[n_group * 4u + ${e}u]`:S?`0.0`:`0.0h`,O=Array.from({length:p},(e,t)=>`  var acc${t}: vec4<${C}> = vec4<${C}>(${D(0)}, ${D(1)}, ${D(2)}, ${D(3)});`).join(`
`),k=Array.from({length:p},(e,t)=>S?`        let a${t} = aTile[(row_base + ${t}u) * K_TILE_V4 + kv];
        acc${t} = fma(vec4<f32>(b3), vec4<f32>(f32(a${t}.w)), fma(vec4<f32>(b2), vec4<f32>(f32(a${t}.z)), fma(vec4<f32>(b1), vec4<f32>(f32(a${t}.y)), fma(vec4<f32>(b0), vec4<f32>(f32(a${t}.x)), acc${t}))));`:`        let a${t} = aTile[(row_base + ${t}u) * K_TILE_V4 + kv];
        acc${t} = fma(b3, vec4<f16>(a${t}.w), fma(b2, vec4<f16>(a${t}.z), fma(b1, vec4<f16>(a${t}.y), fma(b0, vec4<f16>(a${t}.x), acc${t}))));`).join(`
`),A=Array.from({length:p},(e,t)=>{let n=S?`vec4<f16>(acc${t})`:`acc${t}`;return`  if (${b?`m_base + ${t}u < HW`:`n_group < OUT_C_V4 && m_base + ${t}u < HW`}) {
    let m${t} = m_base + ${t}u;
    let oc${t} = n_group * 4u;
    let v${t} = ${n};
    let idx${t}0 = (oc${t} + 0u) * HW + m${t};
    let idx${t}1 = (oc${t} + 1u) * HW + m${t};
    let idx${t}2 = (oc${t} + 2u) * HW + m${t};
    let idx${t}3 = (oc${t} + 3u) * HW + m${t};
    output[idx${t}0] = v${t}.x${a?` + residual[idx${t}0]`:``};
    output[idx${t}1] = v${t}.y${a?` + residual[idx${t}1]`:``};
    output[idx${t}2] = v${t}.z${a?` + residual[idx${t}2]`:``};
    output[idx${t}3] = v${t}.w${a?` + residual[idx${t}3]`:``};
  }`}).join(`
`),j=x&&b?`      bTile[i] = weight[(k_base + kk) * OUT_C_V4 + bg];`:x?`      if (bg < OUT_C_V4) { bTile[i] = weight[(k_base + kk) * OUT_C_V4 + bg]; }
      else { bTile[i] = vec4<f16>(0.0h); }`:b?`      if (k_base + kk < IN_C) { bTile[i] = weight[(k_base + kk) * OUT_C_V4 + bg]; }
      else { bTile[i] = vec4<f16>(0.0h); }`:`      if (k_base + kk < IN_C && bg < OUT_C_V4) { bTile[i] = weight[(k_base + kk) * OUT_C_V4 + bg]; }
      else { bTile[i] = vec4<f16>(0.0h); }`;return`enable f16;
@group(0) @binding(0) var<storage, read>       input: array<f16>;
@group(0) @binding(1) var<storage, read>       weight: array<vec4<f16>>;
${i?`@group(0) @binding(2) var<storage, read>       bias: array<${w}>;
`:``}${a?`@group(0) @binding(${T}) var<storage, read>       residual: array<f16>;
`:``}@group(0) @binding(${E}) var<storage, read_write> output: array<f16>;

const IN_C: u32 = ${e}u;
const OUT_C_V4: u32 = ${t/4}u;
const H: u32 = ${n}u;
const W: u32 = ${r}u;
const HW: u32 = ${n*r}u;
const K_TILE: u32 = ${m}u;
const K_TILE_V4: u32 = ${y}u;
const WG_X: u32 = ${g}u;
const ROW_PER_THREAD: u32 = ${p}u;
const WG: u32 = ${v}u;

var<workgroup> aTile: array<vec4<f16>, ${d*y}>;
var<workgroup> bTile: array<vec4<f16>, ${m*g}>;

fn loadInput(m: u32, ic: u32) -> f16 {
  if (m >= HW || ic >= IN_C) { return 0.0h; }
  return input[ic * HW + m];
}

@compute @workgroup_size(${g}, ${_}, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let lx = lid.x;
  let ly = lid.y;
  let tid = ly * WG_X + lx;
  let row_base = ly * ROW_PER_THREAD;
  let m_base = wg.y * ${d}u + row_base;
  let n_group = wg.x * WG_X + lx;
${O}
  for (var k_base: u32 = 0u; k_base < IN_C; k_base = k_base + K_TILE) {
    for (var i: u32 = tid; i < ${d*y}u; i = i + WG) {
      let tm = i / K_TILE_V4;
      let kv = i - tm * K_TILE_V4;
      let m = wg.y * ${d}u + tm;
      let k0 = k_base + kv * 4u;
      aTile[i] = vec4<f16>(loadInput(m, k0 + 0u), loadInput(m, k0 + 1u), loadInput(m, k0 + 2u), loadInput(m, k0 + 3u));
    }
    for (var i: u32 = tid; i < ${m*g}u; i = i + WG) {
      let kk = i / WG_X;
      let nx = i - kk * WG_X;
      let bg = wg.x * WG_X + nx;
${j}
    }
    workgroupBarrier();
    if (m_base < HW) {
      for (var kv: u32 = 0u; kv < K_TILE_V4; kv = kv + 1u) {
        let b0 = bTile[(kv * 4u + 0u) * WG_X + lx];
        let b1 = bTile[(kv * 4u + 1u) * WG_X + lx];
        let b2 = bTile[(kv * 4u + 2u) * WG_X + lx];
        let b3 = bTile[(kv * 4u + 3u) * WG_X + lx];
${k}
      }
    }
    workgroupBarrier();
  }
${A}
}
`}function ni({inC:e,outC:t,H:n,W:r,hasBias:i,outTile:a=16,icTile:o=16,inputDtype:s=`float16`,weightDtype:c=`float16`,biasDtype:l=`float16`,outputDtype:u=`float16`,phaseY:d=0,phaseX:f=0}){if(t%a!==0)throw Error(`outC must be divisible by outTile`);if(d!==0&&d!==1||f!==0&&f!==1)throw Error(`upsample conv phase must be 0 or 1`);let p=c===`float16`?`float16`:`float32`,m=p===`float16`?2:4;if(a*o*4*m>16*1024)throw Error(`upsample conv shared-weight tile exceeds 16KB workgroup storage`);let h=U(s),g=U(c),_=U(p),v=U(l),y=U(u),b=n*2,x=r*2,S=a*o*4,C=d===0?-1:0,w=d===0?0:1,T=f===0?-1:0,E=f===0?0:1,D=[],O=[],k=[];for(let e=0;e<a;++e)D.push(`  var acc${e}: f32 = ${i?W(`bias[oc_base + ${e}u]`,l):`0.0`};`),O.push(`      acc${e} = acc${e} + v0 * ${W(`wTile[${e*o*4}u + li * 4u + 0u]`,p)}
          + v1 * ${W(`wTile[${e*o*4}u + li * 4u + 1u]`,p)}
          + v2 * ${W(`wTile[${e*o*4}u + li * 4u + 2u]`,p)}
          + v3 * ${W(`wTile[${e*o*4}u + li * 4u + 3u]`,p)};`),k.push(`    output[(oc_base + ${e}u) * OUT_HW + out_y * OUT_W + out_x] = ${Jr(`acc${e}`,u)};`);return`${qr(s,c,l,u)}struct Params { _pad0: u32, _pad1: u32, _pad2: u32, _pad3: u32 };
@group(0) @binding(0) var<storage, read>       input: array<${h}>;
@group(0) @binding(1) var<storage, read>       weight: array<${g}>;
${i?`@group(0) @binding(2) var<storage, read>       bias: array<${v}>;
`:``}@group(0) @binding(${i?3:2}) var<storage, read_write> output: array<${y}>;

const IN_C: u32 = ${e}u;
const OUT_C: u32 = ${t}u;
const H: u32 = ${n}u;
const W: u32 = ${r}u;
const OUT_H: u32 = ${b}u;
const OUT_W: u32 = ${x}u;
const LOW_HW: u32 = ${n*r}u;
const OUT_HW: u32 = ${b*x}u;
const OUT_TILE: u32 = ${a}u;
const IC_TILE: u32 = ${o}u;
const WTILE_ELEMS: u32 = ${S}u;
const PHASE_Y: u32 = ${d}u;
const PHASE_X: u32 = ${f}u;

var<workgroup> wTile: array<${_}, ${S}>;

fn loadInput(ic: u32, iy: i32, ix: i32) -> f32 {
  if (iy < 0 || iy >= i32(H) || ix < 0 || ix >= i32(W)) {
    return 0.0;
  }
  return ${W(`input[ic * LOW_HW + u32(iy) * W + u32(ix)]`,s)};
}

@compute @workgroup_size(8, 8, 1)
fn main(
  @builtin(global_invocation_id) gid: vec3<u32>,
  @builtin(local_invocation_index) local_idx: u32
) {
  let y = gid.x;
  let x = gid.y;
  let oc_base = gid.z * OUT_TILE;
  let isActive = y < H && x < W && oc_base < OUT_C;
  let out_y = y * 2u + PHASE_Y;
  let out_x = x * 2u + PHASE_X;

${D.join(`
`)}
  for (var ic_base: u32 = 0u; ic_base < IN_C; ic_base = ic_base + IC_TILE) {
    let tile_count = min(IC_TILE, IN_C - ic_base);
    for (var wi: u32 = local_idx; wi < WTILE_ELEMS; wi = wi + 64u) {
      let tile_oc = wi / (IC_TILE * 4u);
      let rem0 = wi - tile_oc * IC_TILE * 4u;
      let tile_ic = rem0 / 4u;
      let tap = rem0 - tile_ic * 4u;
      if (tile_ic < tile_count) {
        wTile[wi] = weight[(oc_base + tile_oc) * IN_C * 4u + (ic_base + tile_ic) * 4u + tap];
      } else {
        wTile[wi] = ${p===`float16`?`0.0h`:`0.0`};
      }
    }
    workgroupBarrier();

    for (var li: u32 = 0u; li < tile_count; li = li + 1u) {
      let ic = ic_base + li;
      let v0 = select(0.0, loadInput(ic, i32(y) + ${C}, i32(x) + ${T}), isActive);
      let v1 = select(0.0, loadInput(ic, i32(y) + ${C}, i32(x) + ${E}), isActive);
      let v2 = select(0.0, loadInput(ic, i32(y) + ${w}, i32(x) + ${T}), isActive);
      let v3 = select(0.0, loadInput(ic, i32(y) + ${w}, i32(x) + ${E}), isActive);
${O.join(`
`)}
    }
    workgroupBarrier();
  }

  if (isActive) {
${k.join(`
`)}
  }
}
`}function ri({inC:e,outC:t,H:n,W:r,hasBias:i,inputDtype:a=`float16`,weightDtype:o=`float16`,biasDtype:s=`float16`,outputDtype:c=`float16`,phaseY:l=0,phaseX:u=0,mTile:d=88,nTile:f=16,rowPerThread:p=11,kTile:m=32,accumDtype:h=`float16`}){if(a!==`float16`||o!==`float16`||c!==`float16`)throw Error(`packed upsample conv currently requires f16 input, weights, and output`);if(t%4!=0||m%4!=0||e*4%m!=0)throw Error(`packed upsample conv requires outC divisible by 4 and K divisible by kTile`);if(d%p!==0)throw Error(`packed upsample conv requires mTile divisible by rowPerThread`);if(l!==0&&l!==1||u!==0&&u!==1)throw Error(`upsample conv phase must be 0 or 1`);let g=f,_=d/p,v=g*_;if(v>256)throw Error(`packed upsample conv exceeds max workgroup invocations`);let y=e*4,b=m/4;if((d*b+m*g)*8>16*1024)throw Error(`packed upsample conv exceeds 16KB workgroup storage`);let x=t%(f*4)==0;if(h!==`float16`&&h!==`float32`)throw Error(`packed upsample conv accumulation must be f16 or f32`);let S=n*2,C=r*2,w=S*C,T=g*4,E=h===`float32`,D=E?`f32`:`f16`,O=U(s),k=l===0?-1:0,A=l===0?0:1,j=u===0?-1:0,M=u===0?0:1,N=i?E?`vec4<f32>(
    ${W(`bias[n_group * 4u + 0u]`,s)},
    ${W(`bias[n_group * 4u + 1u]`,s)},
    ${W(`bias[n_group * 4u + 2u]`,s)},
    ${W(`bias[n_group * 4u + 3u]`,s)})`:`vec4<f16>(
    ${s===`float16`?`bias[n_group * 4u + 0u]`:`f16(bias[n_group * 4u + 0u])`},
    ${s===`float16`?`bias[n_group * 4u + 1u]`:`f16(bias[n_group * 4u + 1u])`},
    ${s===`float16`?`bias[n_group * 4u + 2u]`:`f16(bias[n_group * 4u + 2u])`},
    ${s===`float16`?`bias[n_group * 4u + 3u]`:`f16(bias[n_group * 4u + 3u])`})`:E?`vec4<f32>(0.0)`:`vec4<f16>(0.0h)`,P=Array.from({length:p},(e,t)=>`  var acc${t}: vec4<${D}> = ${N};`).join(`
`),F=Array.from({length:p},(e,t)=>E?`        let a_vec${t} = aTile[(row_base + ${t}u) * K_TILE_V4 + kv];
        acc${t} = fma(vec4<f32>(b3), vec4<f32>(f32(a_vec${t}.w)), fma(vec4<f32>(b2), vec4<f32>(f32(a_vec${t}.z)), fma(vec4<f32>(b1), vec4<f32>(f32(a_vec${t}.y)), fma(vec4<f32>(b0), vec4<f32>(f32(a_vec${t}.x)), acc${t}))));`:`        let a_vec${t} = aTile[(row_base + ${t}u) * K_TILE_V4 + kv];
        acc${t} = fma(b3, vec4<f16>(a_vec${t}.w), fma(b2, vec4<f16>(a_vec${t}.z), fma(b1, vec4<f16>(a_vec${t}.y), fma(b0, vec4<f16>(a_vec${t}.x), acc${t}))));`).join(`
`),I=Array.from({length:p},(e,t)=>`  storeVec4(m_base + ${t}u, n_group, ${E?`vec4<f16>(acc${t})`:`acc${t}`});`).join(`
`),ee=x?`if (m_global >= LOW_HW) {`:`if (m_global >= LOW_HW || n_group >= N_V4) {`,L=x?`      bTile[i] = weight[(k_base + kk) * N_V4 + b_group];`:`      if (b_group < N_V4) {
        bTile[i] = weight[(k_base + kk) * N_V4 + b_group];
      } else {
        bTile[i] = vec4<f16>(0.0h);
      }`,te=i?3:2;return`enable f16;
@group(0) @binding(0) var<storage, read>       input: array<f16>;
@group(0) @binding(1) var<storage, read>       weight: array<vec4<f16>>;
${i?`@group(0) @binding(2) var<storage, read>       bias: array<${O}>;
`:``}@group(0) @binding(${te}) var<storage, read_write> output: array<f16>;

const IN_C: u32 = ${e}u;
const OUT_C: u32 = ${t}u;
const H: u32 = ${n}u;
const W: u32 = ${r}u;
const LOW_HW: u32 = ${n*r}u;
const OUT_H: u32 = ${S}u;
const OUT_W: u32 = ${C}u;
const OUT_HW: u32 = ${w}u;
const K_TOTAL: u32 = ${y}u;
const K_V4: u32 = ${e}u;
const N_V4: u32 = ${t/4}u;
const M_TILE: u32 = ${d}u;
const WG_X: u32 = ${g}u;
const WG_Y: u32 = ${_}u;
const ROW_PER_THREAD: u32 = ${p}u;
const OUT_TILE: u32 = ${T}u;
const K_TILE: u32 = ${m}u;
const K_TILE_V4: u32 = ${b}u;
const WG: u32 = ${v}u;
const PHASE_Y: u32 = ${l}u;
const PHASE_X: u32 = ${u}u;

var<workgroup> aTile: array<vec4<f16>, ${d*b}>;
var<workgroup> bTile: array<vec4<f16>, ${m*g}>;

fn loadOne(ic: u32, iy: i32, ix: i32) -> f16 {
  if (iy < 0 || iy >= i32(H) || ix < 0 || ix >= i32(W)) {
    return 0.0h;
  }
  return input[ic * LOW_HW + u32(iy) * W + u32(ix)];
}

fn loadInputVec(m_global: u32, ic: u32) -> vec4<f16> {
  if (m_global >= LOW_HW || ic >= IN_C) {
    return vec4<f16>(0.0h);
  }
  let y = m_global / W;
  let x = m_global - y * W;
  return vec4<f16>(
    loadOne(ic, i32(y) + ${k}, i32(x) + ${j}),
    loadOne(ic, i32(y) + ${k}, i32(x) + ${M}),
    loadOne(ic, i32(y) + ${A}, i32(x) + ${j}),
    loadOne(ic, i32(y) + ${A}, i32(x) + ${M})
  );
}

fn storeVec4(m_global: u32, n_group: u32, v: vec4<f16>) {
  ${ee}
    return;
  }
  let y = m_global / W;
  let x = m_global - y * W;
  let out_y = y * 2u + PHASE_Y;
  let out_x = x * 2u + PHASE_X;
  let out_pos = out_y * OUT_W + out_x;
  let oc = n_group * 4u;
  output[(oc + 0u) * OUT_HW + out_pos] = v.x;
  output[(oc + 1u) * OUT_HW + out_pos] = v.y;
  output[(oc + 2u) * OUT_HW + out_pos] = v.z;
  output[(oc + 3u) * OUT_HW + out_pos] = v.w;
}

@compute @workgroup_size(${g}, ${_}, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let lx = lid.x;
  let ly = lid.y;
  let tid = ly * WG_X + lx;
  let row_base = ly * ROW_PER_THREAD;
  let m_base = wg.y * M_TILE + row_base;
  let n_group = wg.x * WG_X + lx;
${P}

  for (var k_base: u32 = 0u; k_base < K_TOTAL; k_base = k_base + K_TILE) {
    let k_base_v4 = k_base / 4u;
    for (var i: u32 = tid; i < ${d*b}u; i = i + WG) {
      let tm = i / K_TILE_V4;
      let kv = i - tm * K_TILE_V4;
      let gm = wg.y * M_TILE + tm;
      aTile[i] = loadInputVec(gm, k_base_v4 + kv);
    }
    for (var i: u32 = tid; i < ${m*g}u; i = i + WG) {
      let kk = i / WG_X;
      let nx = i - kk * WG_X;
      let b_group = wg.x * WG_X + nx;
${L}
    }
    workgroupBarrier();

    if (m_base < LOW_HW) {
      for (var kv: u32 = 0u; kv < K_TILE_V4; kv = kv + 1u) {
        let b0 = bTile[(kv * 4u + 0u) * WG_X + lx];
        let b1 = bTile[(kv * 4u + 1u) * WG_X + lx];
        let b2 = bTile[(kv * 4u + 2u) * WG_X + lx];
        let b3 = bTile[(kv * 4u + 3u) * WG_X + lx];
${F}
      }
    }
    workgroupBarrier();
  }

${I}
}
`}function ii({inC:e,outC:t,H:n,W:r,hasBias:i,hasAdd:a=!1,inputDtype:o=`float32`,weightDtype:s=`float32`,biasDtype:c=`float32`,outputDtype:l=`float32`,residualDtype:u=`float32`,tileM:d=32,tileN:f=64,k:p=3,pad:m=1,weightLayout:h=`ic-tap`}){if(e%32!=0)throw Error(`conv subgroup matrix requires inC divisible by 32`);if(t%64!=0)throw Error(`conv subgroup matrix requires outC divisible by 64`);if(d!==32&&d!==64)throw Error(`conv subgroup matrix supports tileM=32 or tileM=64`);if(f!==64&&f!==128)throw Error(`conv subgroup matrix supports tileN=64 or tileN=128`);if(d===64&&f!==64)throw Error(`conv subgroup matrix tileM=64 requires tileN=64`);if(t%f!==0)throw Error(`outC must be divisible by tileN=${f}`);if(!(p===3&&m===1||p===1&&m===0))throw Error(`conv subgroup matrix supports only 3x3 pad1 or 1x1 pad0`);if(h!==`ic-tap`&&h!==`tap-ic`)throw Error(`unsupported conv subgroup weightLayout: ${h}`);if(p!==3&&h!==`ic-tap`)throw Error(`tap-ic conv subgroup weight layout is only valid for 3x3`);let g=n*r,_=e*p*p,v=U(o),y=U(s),b=U(c),x=U(l),S=U(u),C=d===64?f:f/2,w=C/8,T=i?3:2,E=T+ +!!a,D=e=>o===`float16`?e:`f16(${e})`,O=s===`float16`?`weight[oc * K_TOTAL + kk]`:`f16(weight[oc * K_TOTAL + kk])`,k=p===3&&h===`tap-ic`,A=k?``:p===1?`fn loadInputValue(m_global: u32, kk: u32) -> f16 {
  if (m_global >= HW || kk >= K_TOTAL) {
    return 0.0h;
  }
  return ${D(`input[kk * HW + m_global]`)};
}
`:`fn loadInputValue(m_global: u32, kk: u32) -> f16 {
  if (m_global >= HW || kk >= K_TOTAL) {
    return 0.0h;
  }
  let y = m_global / W;
  let x = m_global - y * W;
  let ic = kk / 9u;
  let tap = kk - ic * 9u;
  let kh = tap / 3u;
  let kw = tap - kh * 3u;
  let iy = i32(y) + i32(kh) - 1;
  let ix = i32(x) + i32(kw) - 1;
  if (iy < 0 || iy >= i32(H) || ix < 0 || ix >= i32(W)) {
    return 0.0h;
  }
  return ${D(`input[ic * HW + u32(iy) * W + u32(ix)]`)};
}
`,j=k?`fn loadSHMA(tile_base: u32, k_idx: u32, row: u32, c_idx: u32) {
  let m_global = tile_base + row;
  let col = c_idx * 8u;
  if (m_global >= HW) {
    for (var col_offset: u32 = 0u; col_offset < 8u; col_offset++) {
      tile_A[row * TILE_K + col + col_offset] = 0.0h;
    }
    return;
  }

  let y = m_global / W;
  let x = m_global - y * W;
  let tap = k_idx / IN_C;
  let kh = tap / 3u;
  let kw = tap - kh * 3u;
  let iy = i32(y) + i32(kh) - 1;
  let ix = i32(x) + i32(kw) - 1;
  let valid_pos = iy >= 0 && iy < i32(H) && ix >= 0 && ix < i32(W);
  let ic_base = k_idx - tap * IN_C + col;
  let in_base = u32(iy) * W + u32(ix);
  for (var col_offset: u32 = 0u; col_offset < 8u; col_offset++) {
    if (valid_pos) {
      let ic = ic_base + col_offset;
      tile_A[row * TILE_K + col + col_offset] = ${D(`input[ic * HW + in_base]`)};
    } else {
      tile_A[row * TILE_K + col + col_offset] = 0.0h;
    }
  }
}
`:`fn loadSHMA(tile_base: u32, k_idx: u32, row: u32, c_idx: u32) {
  let m_global = tile_base + row;
  let col = c_idx * 8u;
  for (var col_offset: u32 = 0u; col_offset < 8u; col_offset++) {
    let kk = k_idx + col + col_offset;
    tile_A[row * TILE_K + col + col_offset] = loadInputValue(m_global, kk);
  }
}
`,M=d===64?`  let subtile_idx = 0u;
  let subtile_idy = subtile_id;`:`  let subtile_idx = subtile_id / 2u;
  let subtile_idy = subtile_id % 2u;`,N=d===64?`    loadSHMA(m_global_base, kidx, local_idx / 4u, local_idx % 4u);
    loadSHMA(m_global_base, kidx, local_idx / 4u + 32u, local_idx % 4u);`:`    loadSHMA(m_global_base, kidx, local_idx / 4u, local_idx % 4u);`,P=Array.from({length:2},(e,t)=>Array.from({length:w},(e,n)=>`  var matC${t}${n}: subgroup_matrix_result<f16, 8, 8>;`).join(`
`)).join(`
`),F=Array.from({length:w},(e,t)=>`      var matB${t}: subgroup_matrix_right<f16, 8, 8> = subgroupMatrixLoad<subgroup_matrix_right<f16, 8, 8>>(&tile_B, matrix_b_offset + ${t*8}u * TILE_K, true, TILE_K);`).join(`
`),I=Array.from({length:2},(e,t)=>Array.from({length:w},(e,n)=>`      matC${t}${n} = subgroupMatrixMultiplyAccumulate(matA${t}, matB${n}, matC${t}${n});`).join(`
`)).join(`
`),ee=e=>Array.from({length:w},(t,n)=>`  subgroupMatrixStore(&scratch[subtile_id][${n}], 0u, matC${e}${n}, false, 8u);`).join(`
`),L=Array.from({length:w},(e,t)=>{let n=t*8;return`  storeOne(m, oc_base + col + ${n}u, scratch[src_slot][${t}][row * 8u + col]);
  storeOne(m, oc_base + col2 + ${n}u, scratch[src_slot][${t}][row * 8u + col2]);`}).join(`
`);return`enable f16;
enable subgroups;
enable chromium_experimental_subgroup_matrix;
diagnostic(off, chromium.subgroup_matrix_uniformity);

@group(0) @binding(0) var<storage, read>       input: array<${v}>;
@group(0) @binding(1) var<storage, read>       weight: array<${y}>;
${i?`@group(0) @binding(2) var<storage, read>       bias: array<${b}>;
`:``}${a?`@group(0) @binding(${T}) var<storage, read>       residual: array<${S}>;
`:``}@group(0) @binding(${E}) var<storage, read_write> output: array<${x}>;

const IN_C:       u32 = ${e}u;
const OUT_C:      u32 = ${t}u;
const H:          u32 = ${n}u;
const W:          u32 = ${r}u;
const HW:         u32 = ${g}u;
const K_TOTAL:    u32 = ${_}u;
const TILE_COLS:  u32 = ${f}u;
const TILE_ROWS:  u32 = ${d}u;
const TILE_K:     u32 = 32u;
const SUB_COLS:   u32 = ${C}u;
const SUB_ROWS:   u32 = 16u;

var<workgroup> tile_A: array<f16, ${d} * 32>;
var<workgroup> tile_B: array<f16, ${f} * 32>;
var<workgroup> scratch: array<array<array<f16, 64>, ${w}>, 4>;

${A}
${j}

fn loadSHMB(tile_base: u32, k_idx: u32, row: u32, c_idx: u32) {
  let col = c_idx * 16u;
  for (var row_offset: u32 = 0u; row_offset < TILE_COLS; row_offset = row_offset + 64u) {
    let b_row = row + row_offset;
    let oc = tile_base + b_row;
    for (var i: u32 = 0u; i < 16u; i++) {
      let kk = k_idx + col + i;
      if (oc < OUT_C && kk < K_TOTAL) {
        tile_B[b_row * TILE_K + col + i] = ${O};
      } else {
        tile_B[b_row * TILE_K + col + i] = 0.0h;
      }
    }
  }
}

fn storeOne(m_global: u32, oc: u32, value: f16) {
  if (m_global < HW && oc < OUT_C) {
    let idx = oc * HW + m_global;
    let out_value = f32(value)${i?` + ${W(`bias[oc]`,c)}`:``}${a?` + ${W(`residual[idx]`,u)}`:``};
    output[idx] = ${Jr(`out_value`,l)};
  }
}

fn storeOutput(m_base: u32, oc_base: u32, row: u32, col: u32, src_slot: u32) {
  let m = m_base + row;
  let col2 = col + 1u;
${L}
}

@compute @workgroup_size(128, 1, 1)
fn main(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_index) local_idx: u32,
  @builtin(subgroup_invocation_id) sg_id: u32,
  @builtin(subgroup_size) sg_size: u32
) {
  let m_global_base = workgroup_id.y * TILE_ROWS;
  let oc_global_base = workgroup_id.x * TILE_COLS;

  let subtile_id = local_idx / sg_size;
${M}
  let base_A = subtile_idy * SUB_ROWS;
  let base_B = subtile_idx * SUB_COLS;

${P}

  for (var kidx: u32 = 0u; kidx < K_TOTAL; kidx = kidx + TILE_K) {
${N}
    loadSHMB(oc_global_base, kidx, local_idx / 2u, local_idx % 2u);
    workgroupBarrier();

    for (var step: u32 = 0u; step < TILE_K; step = step + 8u) {
      let matrix_a_offset = subtile_idy * SUB_ROWS * TILE_K + step;
      var matA0: subgroup_matrix_left<f16, 8, 8> = subgroupMatrixLoad<subgroup_matrix_left<f16, 8, 8>>(&tile_A, matrix_a_offset, false, TILE_K);
      var matA1: subgroup_matrix_left<f16, 8, 8> = subgroupMatrixLoad<subgroup_matrix_left<f16, 8, 8>>(&tile_A, matrix_a_offset + 8u * TILE_K, false, TILE_K);

      let matrix_b_offset = subtile_idx * SUB_COLS * TILE_K + step;
${F}

${I}
    }
    workgroupBarrier();
  }

${ee(0)}
  let row = sg_id / 4u;
  let col = (sg_id % 4u) * 2u;
  storeOutput(m_global_base + base_A, oc_global_base + base_B, row, col, subtile_id);

${ee(1)}
  storeOutput(m_global_base + base_A + 8u, oc_global_base + base_B, row, col, subtile_id);
}
`}function ai({inC:e,outC:t,H:n,W:r,hasBias:i,inputDtype:a=`float16`,weightDtype:o=`float16`,biasDtype:s=`float16`,outputDtype:c=`float16`,tileN:l=64,phaseY:u=0,phaseX:d=0,fusedWeights:f=!1}){if(e%32!=0)throw Error(`upsample conv subgroup matrix requires inC divisible by 32`);if(t%64!=0)throw Error(`upsample conv subgroup matrix requires outC divisible by 64`);if(l!==64&&l!==128)throw Error(`upsample conv subgroup matrix supports tileN=64 or tileN=128`);if(t%l!==0)throw Error(`outC must be divisible by tileN=${l}`);if(u!==0&&u!==1||d!==0&&d!==1)throw Error(`upsample conv phase must be 0 or 1`);let p=n*r,m=n*2,h=r*2,g=m*h,_=e*4,v=U(a),y=U(o),b=U(s),x=U(c),S=l/2,C=S/8,w=i?3:2,T=u===0?-1:0,E=u===0?0:1,D=d===0?-1:0,O=d===0?0:1,k=u===0?[[0],[1,2]]:[[0,1],[2]],A=d===0?[[0],[1,2]]:[[0,1],[2]],j=f?``:[0,1,2,3].map(e=>{let t=Math.floor(e/2),n=e%2,r=[];for(let e of k[t])for(let t of A[n])r.push(W(`weight[oc * OC_STRIDE + ic * 9u + ${e*3+t}u]`,o));return`${e===0?`  if`:`  else if`} (tap == ${e}u) {
    return f16(${r.join(` + `)});
  }`}).join(`
`),M=f?`fn loadWeightValue(oc: u32, kk: u32) -> f16 {
  if (oc >= OUT_C || kk >= K_TOTAL) {
    return 0.0h;
  }
  return ${o===`float16`?`weight[oc * K_TOTAL + kk]`:`f16(weight[oc * K_TOTAL + kk])`};
}
`:`fn loadWeightValue(oc: u32, kk: u32) -> f16 {
  if (oc >= OUT_C || kk >= K_TOTAL) {
    return 0.0h;
  }
  let ic = kk / 4u;
  let tap = kk - ic * 4u;
${j}
  return 0.0h;
}
`,N=Array.from({length:2},(e,t)=>Array.from({length:C},(e,n)=>`  var matC${t}${n}: subgroup_matrix_result<f16, 8, 8>;`).join(`
`)).join(`
`),P=Array.from({length:C},(e,t)=>`      var matB${t}: subgroup_matrix_right<f16, 8, 8> = subgroupMatrixLoad<subgroup_matrix_right<f16, 8, 8>>(&tile_B, matrix_b_offset + ${t*8}u * TILE_K, true, TILE_K);`).join(`
`),F=Array.from({length:2},(e,t)=>Array.from({length:C},(e,n)=>`      matC${t}${n} = subgroupMatrixMultiplyAccumulate(matA${t}, matB${n}, matC${t}${n});`).join(`
`)).join(`
`),I=e=>Array.from({length:C},(t,n)=>`  subgroupMatrixStore(&scratch[subtile_id][${n}], 0u, matC${e}${n}, false, 8u);`).join(`
`),ee=Array.from({length:C},(e,t)=>{let n=t*8;return`  storeOne(m, oc_base + col + ${n}u, scratch[src_slot][${t}][row * 8u + col]);
  storeOne(m, oc_base + col2 + ${n}u, scratch[src_slot][${t}][row * 8u + col2]);`}).join(`
`);return`enable f16;
enable subgroups;
enable chromium_experimental_subgroup_matrix;
diagnostic(off, chromium.subgroup_matrix_uniformity);

@group(0) @binding(0) var<storage, read>       input: array<${v}>;
@group(0) @binding(1) var<storage, read>       weight: array<${y}>;
${i?`@group(0) @binding(2) var<storage, read>       bias: array<${b}>;
`:``}@group(0) @binding(${w}) var<storage, read_write> output: array<${x}>;

const IN_C:       u32 = ${e}u;
const OUT_C:      u32 = ${t}u;
const H:          u32 = ${n}u;
const W:          u32 = ${r}u;
const LOW_HW:     u32 = ${p}u;
const OUT_H:      u32 = ${m}u;
const OUT_W:      u32 = ${h}u;
const OUT_HW:     u32 = ${g}u;
const K_TOTAL:    u32 = ${_}u;
const OC_STRIDE:  u32 = ${e*9}u;
const TILE_COLS:  u32 = ${l}u;
const TILE_ROWS:  u32 = 32u;
const TILE_K:     u32 = 32u;
const SUB_COLS:   u32 = ${S}u;
const SUB_ROWS:   u32 = 16u;
const PHASE_Y:    u32 = ${u}u;
const PHASE_X:    u32 = ${d}u;

var<workgroup> tile_A: array<f16, 32 * 32>;
var<workgroup> tile_B: array<f16, ${l} * 32>;
var<workgroup> scratch: array<array<array<f16, 64>, ${C}>, 4>;

fn loadInputValue(m_global: u32, kk: u32) -> f16 {
  if (m_global >= LOW_HW || kk >= K_TOTAL) {
    return 0.0h;
  }
  let y = m_global / W;
  let x = m_global - y * W;
  let ic = kk / 4u;
  let tap = kk - ic * 4u;
  let tap_y = tap / 2u;
  let tap_x = tap - tap_y * 2u;
  let iy = i32(y) + select(${T}, ${E}, tap_y == 1u);
  let ix = i32(x) + select(${D}, ${O}, tap_x == 1u);
  if (iy < 0 || iy >= i32(H) || ix < 0 || ix >= i32(W)) {
    return 0.0h;
  }
  return ${a===`float16`?`input[ic * LOW_HW + u32(iy) * W + u32(ix)]`:`f16(input[ic * LOW_HW + u32(iy) * W + u32(ix)])`};
}

${M}

fn loadSHMA(tile_base: u32, k_idx: u32, row: u32, c_idx: u32) {
  let m_global = tile_base + row;
  let col = c_idx * 8u;
  for (var col_offset: u32 = 0u; col_offset < 8u; col_offset++) {
    let kk = k_idx + col + col_offset;
    tile_A[row * TILE_K + col + col_offset] = loadInputValue(m_global, kk);
  }
}

fn loadSHMB(tile_base: u32, k_idx: u32, row: u32, c_idx: u32) {
  let col = c_idx * 16u;
  for (var row_offset: u32 = 0u; row_offset < TILE_COLS; row_offset = row_offset + 64u) {
    let b_row = row + row_offset;
    let oc = tile_base + b_row;
    for (var i: u32 = 0u; i < 16u; i++) {
      let kk = k_idx + col + i;
      tile_B[b_row * TILE_K + col + i] = loadWeightValue(oc, kk);
    }
  }
}

fn storeOne(m_global: u32, oc: u32, value: f16) {
  if (m_global < LOW_HW && oc < OUT_C) {
    let low_y = m_global / W;
    let low_x = m_global - low_y * W;
    let out_y = low_y * 2u + PHASE_Y;
    let out_x = low_x * 2u + PHASE_X;
    let idx = oc * OUT_HW + out_y * OUT_W + out_x;
    let out_value = f32(value)${i?` + ${W(`bias[oc]`,s)}`:``};
    output[idx] = ${Jr(`out_value`,c)};
  }
}

fn storeOutput(m_base: u32, oc_base: u32, row: u32, col: u32, src_slot: u32) {
  let m = m_base + row;
  let col2 = col + 1u;
${ee}
}

@compute @workgroup_size(128, 1, 1)
fn main(
  @builtin(workgroup_id) workgroup_id: vec3<u32>,
  @builtin(local_invocation_index) local_idx: u32,
  @builtin(subgroup_invocation_id) sg_id: u32,
  @builtin(subgroup_size) sg_size: u32
) {
  let m_global_base = workgroup_id.y * TILE_ROWS;
  let oc_global_base = workgroup_id.x * TILE_COLS;

  let subtile_id = local_idx / sg_size;
  let subtile_idx = subtile_id / 2u;
  let subtile_idy = subtile_id % 2u;
  let base_A = subtile_idy * SUB_ROWS;
  let base_B = subtile_idx * SUB_COLS;

${N}

  for (var kidx: u32 = 0u; kidx < K_TOTAL; kidx = kidx + TILE_K) {
    loadSHMA(m_global_base, kidx, local_idx / 4u, local_idx % 4u);
    loadSHMB(oc_global_base, kidx, local_idx / 2u, local_idx % 2u);
    workgroupBarrier();

    for (var step: u32 = 0u; step < TILE_K; step = step + 8u) {
      let matrix_a_offset = subtile_idy * SUB_ROWS * TILE_K + step;
      var matA0: subgroup_matrix_left<f16, 8, 8> = subgroupMatrixLoad<subgroup_matrix_left<f16, 8, 8>>(&tile_A, matrix_a_offset, false, TILE_K);
      var matA1: subgroup_matrix_left<f16, 8, 8> = subgroupMatrixLoad<subgroup_matrix_left<f16, 8, 8>>(&tile_A, matrix_a_offset + 8u * TILE_K, false, TILE_K);

      let matrix_b_offset = subtile_idx * SUB_COLS * TILE_K + step;
${P}

${F}
    }
    workgroupBarrier();
  }

${I(0)}
  let row = sg_id / 4u;
  let col = (sg_id % 4u) * 2u;
  storeOutput(m_global_base + base_A, oc_global_base + base_B, row, col, subtile_id);

${I(1)}
  storeOutput(m_global_base + base_A + 8u, oc_global_base + base_B, row, col, subtile_id);
}
`}function oi({C:e,H:t,W:n,groups:r,eps:i,applySilu:a=!1,inputDtype:o=`float32`,weightDtype:s=`float32`,biasDtype:c=`float32`,outputDtype:l=`float32`}){if(e%r!==0)throw Error(`C must be divisible by groups`);let u=e/r,d=U(o),f=U(s),p=U(c),m=U(l);return`${qr(o,s,c,l)}struct Params { _pad0: u32, _pad1: u32, _pad2: u32, _pad3: u32 };
@group(0) @binding(0) var<storage, read>       input: array<${d}>;
@group(0) @binding(1) var<storage, read>       gWeight: array<${f}>;
@group(0) @binding(2) var<storage, read>       gBias: array<${p}>;
@group(0) @binding(3) var<storage, read_write> output: array<${m}>;

const C: u32 = ${e}u;
const H: u32 = ${t}u;
const W: u32 = ${n}u;
const GROUPS: u32 = ${r}u;
const CPG: u32 = ${u}u;
const HW: u32 = ${t*n}u;
const GROUP_SIZE: u32 = ${u*t*n}u;
const EPS: f32 = ${i};
const WG: u32 = 256u;

var<workgroup> partial: array<f32, 256>;
fn reduce_sum(tid: u32) -> f32 {
  workgroupBarrier();
  var stride: u32 = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) { partial[tid] = partial[tid] + partial[tid + stride]; }
    stride = stride / 2u;
    workgroupBarrier();
  }
  return partial[0];
}

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let g = wg.x;
  if (g >= GROUPS) { return; }
  let tid = lid.x;
  let g_offset = g * GROUP_SIZE;

  // Sum to compute mean.
  var s: f32 = 0.0;
  for (var i: u32 = tid; i < GROUP_SIZE; i = i + WG) {
    s = s + ${W(`input[g_offset + i]`,o)};
  }
  partial[tid] = s;
  let mean = reduce_sum(tid) / f32(GROUP_SIZE);

  // Sum of squared deviations.
  var sq: f32 = 0.0;
  for (var i: u32 = tid; i < GROUP_SIZE; i = i + WG) {
    let d = ${W(`input[g_offset + i]`,o)} - mean;
    sq = sq + d * d;
  }
  partial[tid] = sq;
  let invStd = inverseSqrt(reduce_sum(tid) / f32(GROUP_SIZE) + EPS);

  // Apply per-channel weight/bias.
  for (var i: u32 = tid; i < GROUP_SIZE; i = i + WG) {
    let local_c = i / HW;
    let c_idx = g * CPG + local_c;
    var v = (${W(`input[g_offset + i]`,o)} - mean) * invStd * ${W(`gWeight[c_idx]`,s)} + ${W(`gBias[c_idx]`,c)};
${a?`    v = v / (1.0 + exp(-v));
`:``}    output[g_offset + i] = ${Jr(`v`,l)};
  }
}
`}function si({C:e,H:t,W:n,groups:r,elementsPerWorkgroup:i=1024,inputDtype:a=`float32`}){if(e%r!==0)throw Error(`C must be divisible by groups`);let o=e/r*t*n,s=Math.ceil(o/i),c=U(a);return`${qr(a)}@group(0) @binding(0) var<storage, read>       input: array<${c}>;
@group(0) @binding(1) var<storage, read_write> partial: array<f32>;

const GROUP_SIZE: u32 = ${o}u;
const CHUNKS: u32 = ${s}u;
const ELEMENTS_PER_WG: u32 = ${i}u;
const WG: u32 = 256u;

var<workgroup> partialSum: array<f32, 256>;
var<workgroup> partialSq: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let chunk = wg.x;
  let g = wg.y;
  let tid = lid.x;
  let group_start = g * GROUP_SIZE;
  let start = group_start + chunk * ELEMENTS_PER_WG;
  let end = min(start + ELEMENTS_PER_WG, group_start + GROUP_SIZE);

  var s = 0.0;
  var ss = 0.0;
  for (var i = start + tid; i < end; i = i + WG) {
    let v = ${W(`input[i]`,a)};
    s = s + v;
    ss = ss + v * v;
  }
  partialSum[tid] = s;
  partialSq[tid] = ss;
  workgroupBarrier();
  var stride = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      partialSum[tid] = partialSum[tid] + partialSum[tid + stride];
      partialSq[tid] = partialSq[tid] + partialSq[tid + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  if (tid == 0u) {
    let out_idx = (g * CHUNKS + chunk) * 2u;
    partial[out_idx] = partialSum[0];
    partial[out_idx + 1u] = partialSq[0];
  }
}
`}function ci({C:e,H:t,W:n,groups:r,elementsPerWorkgroup:i=4096}){if(e%r!==0)throw Error(`C must be divisible by groups`);if(i%4!=0)throw Error(`vec4 groupnorm reduce requires elementsPerWorkgroup divisible by 4`);let a=e/r*t*n;if(a%4!=0)throw Error(`vec4 groupnorm reduce requires group size divisible by 4`);let o=a/4,s=i/4;return`enable f16;
@group(0) @binding(0) var<storage, read>       input: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read_write> partial: array<f32>;

const GROUP_SIZE: u32 = ${a}u;
const VEC_GROUP_SIZE: u32 = ${o}u;
const CHUNKS: u32 = ${Math.ceil(o/s)}u;
const VECS_PER_WG: u32 = ${s}u;
const WG: u32 = 256u;

var<workgroup> partialSum: array<f32, 256>;
var<workgroup> partialSq: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let chunk = wg.x;
  let g = wg.y;
  let tid = lid.x;
  let group_start = g * VEC_GROUP_SIZE;
  let start = group_start + chunk * VECS_PER_WG;
  let end = min(start + VECS_PER_WG, group_start + VEC_GROUP_SIZE);

  var s = 0.0;
  var ss = 0.0;
  for (var i = start + tid; i < end; i = i + WG) {
    let v = vec4<f32>(input[i]);
    s = s + v.x + v.y + v.z + v.w;
    ss = ss + dot(v, v);
  }
  partialSum[tid] = s;
  partialSq[tid] = ss;
  workgroupBarrier();
  var stride = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      partialSum[tid] = partialSum[tid] + partialSum[tid + stride];
      partialSq[tid] = partialSq[tid] + partialSq[tid + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  if (tid == 0u) {
    let out_idx = (g * CHUNKS + chunk) * 2u;
    partial[out_idx] = partialSum[0];
    partial[out_idx + 1u] = partialSq[0];
  }
}
`}function li({C:e,H:t,W:n,groups:r,eps:i,elementsPerWorkgroup:a=1024}){if(e%r!==0)throw Error(`C must be divisible by groups`);let o=e/r*t*n;return`@group(0) @binding(0) var<storage, read>       partial: array<f32>;
@group(0) @binding(1) var<storage, read_write> stats: array<f32>;

const GROUP_SIZE: u32 = ${o}u;
const CHUNKS: u32 = ${Math.ceil(o/a)}u;
const EPS: f32 = ${i};
const WG: u32 = 256u;

var<workgroup> partialSum: array<f32, 256>;
var<workgroup> partialSq: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let g = wg.x;
  let tid = lid.x;
  var s = 0.0;
  var ss = 0.0;
  for (var chunk = tid; chunk < CHUNKS; chunk = chunk + WG) {
    let idx = (g * CHUNKS + chunk) * 2u;
    s = s + partial[idx];
    ss = ss + partial[idx + 1u];
  }
  partialSum[tid] = s;
  partialSq[tid] = ss;
  workgroupBarrier();
  var stride = WG / 2u;
  loop {
    if (stride == 0u) { break; }
    if (tid < stride) {
      partialSum[tid] = partialSum[tid] + partialSum[tid + stride];
      partialSq[tid] = partialSq[tid] + partialSq[tid + stride];
    }
    stride = stride / 2u;
    workgroupBarrier();
  }
  if (tid == 0u) {
    let mean = partialSum[0] / f32(GROUP_SIZE);
    let ex2 = partialSq[0] / f32(GROUP_SIZE);
    let variance = max(ex2 - mean * mean, 0.0);
    stats[g * 2u] = mean;
    stats[g * 2u + 1u] = inverseSqrt(variance + EPS);
  }
}
`}function ui({C:e,H:t,W:n,groups:r,applySilu:i=!1,inputDtype:a=`float32`,weightDtype:o=`float32`,biasDtype:s=`float32`,outputDtype:c=`float32`}){if(e%r!==0)throw Error(`C must be divisible by groups`);let l=e/r;e*t*n;let u=U(a),d=U(o),f=U(s),p=U(c);return`${qr(a,o,s,c)}struct Params { count: u32, wgY: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       input: array<${u}>;
@group(0) @binding(1) var<storage, read>       stats: array<f32>;
@group(0) @binding(2) var<storage, read>       gWeight: array<${d}>;
@group(0) @binding(3) var<storage, read>       gBias: array<${f}>;
@group(0) @binding(4) var<storage, read_write> output: array<${p}>;
@group(0) @binding(5) var<uniform>             params: Params;

const HW: u32 = ${t*n}u;
const CPG: u32 = ${l}u;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let i = wg_idx * 64u + lid.x;
  if (i >= params.count) { return; }
  let c = i / HW;
  let g = c / CPG;
  let mean = stats[g * 2u];
  let invStd = stats[g * 2u + 1u];
  var v = (${W(`input[i]`,a)} - mean) * invStd * ${W(`gWeight[c]`,o)} + ${W(`gBias[c]`,s)};
${i?`  v = v / (1.0 + exp(-v));
`:``}  output[i] = ${Jr(`v`,c)};
}
`}function di({C:e,H:t,W:n,groups:r,applySilu:i=!1}){if(e%r!==0)throw Error(`C must be divisible by groups`);if(t*n%4!=0)throw Error(`vec4 groupnorm apply requires HW divisible by 4`);let a=e/r;return e*t*n/4,`enable f16;
struct Params { count4: u32, wgY: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read>       input: array<vec4<f16>>;
@group(0) @binding(1) var<storage, read>       stats: array<f32>;
@group(0) @binding(2) var<storage, read>       gWeight: array<f16>;
@group(0) @binding(3) var<storage, read>       gBias: array<f16>;
@group(0) @binding(4) var<storage, read_write> output: array<vec4<f16>>;
@group(0) @binding(5) var<uniform>             params: Params;

const HW: u32 = ${t*n}u;
const CPG: u32 = ${a}u;

@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * params.wgY;
  let i4 = wg_idx * 64u + lid.x;
  if (i4 >= params.count4) { return; }
  let elem = i4 * 4u;
  let c = elem / HW;
  let g = c / CPG;
  let mean = stats[g * 2u];
  let invStd = stats[g * 2u + 1u];
  var v = (vec4<f32>(input[i4]) - vec4<f32>(mean)) * vec4<f32>(invStd * f32(gWeight[c])) + vec4<f32>(f32(gBias[c]));
${i?`  v = v / (vec4<f32>(1.0) + exp(-v));
`:``}  output[i4] = vec4<f16>(v);
}
`}function fi({C:e,H:t,W:n,dtype:r=`float32`}){let i=U(r);return`${qr(r)}@group(0) @binding(0) var<storage, read>       input: array<${i}>;
@group(0) @binding(1) var<storage, read_write> output: array<${i}>;
const C: u32 = ${e}u;
const H: u32 = ${t}u;
const W: u32 = ${n}u;
const H2: u32 = ${t*2}u;
const W2: u32 = ${n*2}u;
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let y = gid.x;
  let x = gid.y;
  let c = gid.z;
  if (y >= H2 || x >= W2 || c >= C) { return; }
  output[c * H2 * W2 + y * W2 + x] = input[c * H * W + (y / 2u) * W + (x / 2u)];
}
`}var pi=class e{constructor({rt:e,config:t,w:n}){this.rt=e,this.config=t,this.w=n}destroy(){Bt(this.w),this.w=null}static async fromBf16SafeTensors({rt:t,config:n,safeTensors:r,onProgress:i=null,concurrency:a,chunkMaxBytes:o,signal:s}){let c=!!t.caps().f16,l=t.caps().adapter?.vendor===`apple`,u=n.latent_channels??32,d=Zt(),f=(e,n)=>{d.tensor(e,async e=>{let r=jt(e);n(t.tensorFromTypedArray(`float32`,[r.length],r))})},p=(e,t)=>{r.has(e)?f(e,t):t(null)},m=(e,n)=>{d.tensor(e,async e=>{let r=mi(Mt(e));n(t.tensorFromTypedArray(`float16`,[r.length],r))})},h=(e,t)=>{r.has(e)?m(e,t):t(null)},g=(e,{inC:n=0,outC:r=0,k:i=0}={})=>{let a={};return c?(d.tensor(`${e}.weight`,async e=>{let o=l&&i===3&&r%4==0&&n>=128&&r>=128,s=l&&i===3&&r%4==0&&n>=128&&r>=128,c=l&&i===1&&r%4==0&&n>=128&&r>=64;if(o){a.weightWinogradF2x2=await vi({rt:t,weightF16:Mt(e),inC:n,outC:r});return}if(s){let i=Pt(e,r,n*9);a.weightPackedKOut=t.tensorFromTypedArray(`float16`,[i.length],i);return}if(c){let i=Pt(e,r,n);a.weightPackedKOut1x1=t.tensorFromTypedArray(`float16`,[i.length],i);return}let u=Mt(e);if(!s&&!c){let e=mi(u);a.weight=t.tensorFromTypedArray(`float16`,[e.length],e)}!s&&t.caps().subgroupMatrix&&i===3&&n%32==0&&r%64==0&&(a.weightTapIC=_i({rt:t,weightF16:u,inC:n,outC:r}))}),h(`${e}.bias`,e=>{a.bias=e}),a):(f(`${e}.weight`,e=>{a.weight=e}),p(`${e}.bias`,e=>{a.bias=e}),a)},_=(e,n)=>{let r={};return c?(d.tensor(`${e}.weight`,async e=>{let i=Mt(e),a=l&&n>=128&&n%4==0;if(!a){let e=mi(i);r.weight=t.tensorFromTypedArray(`float16`,[e.length],e)}a||(r.upsampleFusedWeights=hi({rt:t,weightF16:i,inC:n,outC:n})),r.upsamplePackedKOutWeights=gi({rt:t,weightF16:i,inC:n,outC:n})}),h(`${e}.bias`,e=>{r.bias=e}),r):(f(`${e}.weight`,e=>{r.weight=e}),p(`${e}.bias`,e=>{r.bias=e}),r)},v=e=>{let t={};return c?(m(`${e}.weight`,e=>{t.weight=e}),h(`${e}.bias`,e=>{t.bias=e})):(f(`${e}.weight`,e=>{t.weight=e}),p(`${e}.bias`,e=>{t.bias=e})),t},y=(e,t,n)=>({norm1:v(`${e}.norm1`),conv1:g(`${e}.conv1`,{inC:t,outC:n,k:3}),norm2:v(`${e}.norm2`),conv2:g(`${e}.conv2`,{inC:n,outC:n,k:3}),conv_shortcut:r.has(`${e}.conv_shortcut.weight`)?g(`${e}.conv_shortcut`,{inC:t,outC:n,k:1}):null,inC:t,outC:n}),b=(e,t)=>({group_norm:v(`${e}.group_norm`),to_q:g(`${e}.to_q`,{inC:t,outC:t,k:1}),to_k:g(`${e}.to_k`,{inC:t,outC:t,k:1}),to_v:g(`${e}.to_v`,{inC:t,outC:t,k:1}),to_out:g(`${e}.to_out.0`,{inC:t,outC:t,k:1}),channels:t}),x={},S=n.batch_norm_eps??1e-4;x.bn={eps:S},d.tensor(`bn.running_mean`,async e=>{let n=jt(e);x.bn.running_mean=n,x.bn.running_meanT=t.tensorFromTypedArray(`float32`,[n.length],n),x.bn.running_var&&(x.bn.running_std=Float32Array.from(x.bn.running_var,e=>Math.sqrt(e+S)),x.bn.running_stdT=t.tensorFromTypedArray(`float32`,[x.bn.running_std.length],x.bn.running_std))}),d.tensor(`bn.running_var`,async e=>{let n=jt(e);x.bn.running_var=n,x.bn.running_mean&&(x.bn.running_std=Float32Array.from(n,e=>Math.sqrt(e+S)),x.bn.running_stdT=t.tensorFromTypedArray(`float32`,[x.bn.running_std.length],x.bn.running_std))}),x.post_quant_conv=g(`post_quant_conv`,{inC:u,outC:u,k:1}),x.decoder={conv_in:g(`decoder.conv_in`,{inC:u,outC:512,k:3}),mid_block:{resnets:[y(`decoder.mid_block.resnets.0`,512,512),y(`decoder.mid_block.resnets.1`,512,512)],attentions:[b(`decoder.mid_block.attentions.0`,512)]},up_blocks:[],conv_norm_out:v(`decoder.conv_norm_out`),conv_out:g(`decoder.conv_out`)};let C=(n.block_out_channels??[128,256,512,512]).slice().reverse(),w=(n.layers_per_block??2)+1,T=C[0];for(let e=0;e<C.length;++e){let t=C[e],n=[];for(let r=0;r<w;++r){let i=r===0?T:t;n.push(y(`decoder.up_blocks.${e}.resnets.${r}`,i,t))}let i=r.has(`decoder.up_blocks.${e}.upsamplers.0.conv.weight`)?_(`decoder.up_blocks.${e}.upsamplers.0.conv`,t):null;x.decoder.up_blocks.push({resnets:n,upsampler:i,inC:T,outC:t}),T=t}return await r.streamAll(d.onChunk,{concurrency:a,chunkMaxBytes:o,names:d.names(),onProgress:i,signal:s}),d.assertComplete(),new e({rt:t,config:{...n,blockOut:C,layersPerBlock:w},w:x})}async decode(e,t,n,{scope:r=null}={}){let i=!r,a=r??Vt(),o=this.rt;this.rt=Ht(o,a);try{let r=await this._decodeWithRuntime(e,t,n);return i&&a.keep(r.image),r}finally{this.rt=o,i&&a.destroy()}}async _decodeWithRuntime(e,t,n){let r=this.rt,i=this.w,a=this.config.latent_channels??32,o=r.caps().f16?`float16`:`float32`,s=await this._conv2d({inT:e,conv:i.post_quant_conv,inC:a,outC:a,H:t,W:n,k:1,pad:0,outputDtype:o});s=await this._conv2d({inT:s,conv:i.decoder.conv_in,inC:a,outC:512,H:t,W:n,k:3,pad:1,outputDtype:o});let c=512,l=t,u=n;s=await this._resnet({inT:s,rn:i.decoder.mid_block.resnets[0],inC:c,H:l,W:u}),s=await this._attentionMid({inT:s,attn:i.decoder.mid_block.attentions[0],C:c,H:l,W:u}),s=await this._resnet({inT:s,rn:i.decoder.mid_block.resnets[1],inC:c,H:l,W:u});for(let e of i.decoder.up_blocks){for(let t of e.resnets)s=await this._resnet({inT:s,rn:t,inC:t.inC,H:l,W:u}),c=t.outC;if(e.upsampler)if(this._canFuseUpsampleConv({inT:s,conv:e.upsampler,inC:c,outC:c}))s=await this._upsampleConv2d({inT:s,conv:e.upsampler,inC:c,outC:c,H:l,W:u,outputDtype:o}),l*=2,u*=2;else{let t=s.dtype,n=r.empty(t,[c,l*2,u*2],`ups${l}`),i=fi({C:c,H:l,W:u,dtype:t});await r.runProgram({name:`upsample`,source:i,cacheKey:`ups_c${c}_h${l}_w${u}_${t}`,bindings:[{tensor:s,type:`read-only-storage`},{tensor:n,type:`storage`}],workgroups:[Math.ceil(l*2/8),Math.ceil(u*2/8),c]}),l*=2,u*=2,s=await this._conv2d({inT:n,conv:e.upsampler,inC:c,outC:c,H:l,W:u,k:3,pad:1,outputDtype:o})}}return s=await this._groupnorm({inT:s,gn:i.decoder.conv_norm_out,C:c,H:l,W:u,groups:32,eps:1e-6,applySilu:!0,outputDtype:o}),{image:await this._conv2d({inT:s,conv:i.decoder.conv_out,inC:c,outC:3,H:l,W:u,k:3,pad:1,outputDtype:o}),H:l,W:u,channels:3}}async _conv2d({inT:e,conv:t,inC:n,outC:r,H:i,W:a,k:o,pad:s,addT:c=null,outputDtype:l=`float32`}){let u=this.rt,d=r%16==0?16:r%8==0?8:r%4==0?4:1,f=e.dtype,p=o===3&&s===1&&f===`float16`&&l===`float16`&&t.weightWinogradF2x2&&n%8==0&&r%4==0,m=o===3&&s===1&&f===`float16`&&l===`float16`&&t.weightPackedKOut,h=o===1&&s===0&&f===`float16`&&l===`float16`&&t.weightPackedKOut1x1&&n>=128&&r>=64,g=p&&u.caps().adapter?.vendor===`apple`&&n>=128&&r>=128,_=m&&u.caps().adapter?.vendor===`apple`&&n>=128&&r>=128,v=h&&u.caps().adapter?.vendor===`apple`,y=!g&&!_&&!v&&u.caps().subgroupMatrix&&u.caps().f16&&(o===3&&s===1||o===1&&s===0)&&n%32==0&&r%64==0,b=y&&o===3&&t.weightTapIC?t.weightTapIC:t.weight,x=b===t.weightTapIC?`tap-ic`:`ic-tap`,S=t.bias?.dtype??`float32`,C=c?.dtype??`float32`,w=y&&o===3&&x===`tap-ic`?64:32,T=w===64?64:y&&r%128==0?128:64,E=!y&&g,D=!y&&!E&&m,O=!y&&v,k=!D&&!y&&o===3&&s===1&&d>=16,A=E?t.weightWinogradF2x2:D?t.weightPackedKOut:O?t.weightPackedKOut1x1:b,j=_||v?112:32,M=_||v?14:4,N=_||v?32:64,P=y?`sgmat_tm${w}_tn${T}${x===`tap-ic`?`_wti`:``}`:E?`wgf2_tm32_tn8_tk8`:D?`pkn4_tm${j}_tn16_rpt${M}_tk${N}`:O?`pkn4_1x1_tm${j}_tn16_rpt${M}_tk${N}`:k?`sw`:`ot${d}`,F=!!(c&&(y||E||D||O)),I=A.dtype,ee=`conv2d_${n}_${r}_${i}_${a}_${o}_${s}_${t.bias?`b`:`nb`}_${f}_${A.dtype}_${S}_${l}_${P}${F?`_add_${C}`:``}`,L=y?ii({inC:n,outC:r,H:i,W:a,hasBias:!!t.bias,hasAdd:F,inputDtype:f,weightDtype:I,biasDtype:S,outputDtype:l,residualDtype:C,tileM:w,tileN:T,k:o,pad:s,weightLayout:x}):E?$r({inC:n,outC:r,H:i,W:a,hasBias:!!t.bias,hasAdd:F,inputDtype:f,weightDtype:I,biasDtype:S,outputDtype:l,residualDtype:C,mTile:32,nTile:8,kTile:8}):D?Qr({inC:n,outC:r,H:i,W:a,hasBias:!!t.bias,hasAdd:F,inputDtype:f,weightDtype:I,biasDtype:S,outputDtype:l,residualDtype:C,mTile:j,nTile:16,rowPerThread:M,kTile:N}):O?ti({inC:n,outC:r,H:i,W:a,hasBias:!!t.bias,hasAdd:F,inputDtype:f,weightDtype:I,biasDtype:S,outputDtype:l,residualDtype:C,mTile:j,nTile:16,rowPerThread:M,kTile:N}):k?Zr({inC:n,outC:r,H:i,W:a,hasBias:!!t.bias,outTile:d,inputDtype:f,weightDtype:I,biasDtype:S,outputDtype:l}):d>1?Xr({inC:n,outC:r,H:i,W:a,kH:o,kW:o,pad:s,hasBias:!!t.bias,outTile:d,inputDtype:f,weightDtype:I,biasDtype:S,outputDtype:l}):Yr({inC:n,outC:r,H:i,W:a,kH:o,kW:o,pad:s,hasBias:!!t.bias,inputDtype:f,weightDtype:I,biasDtype:S,outputDtype:l}),te=u.empty(l,[r,i,a],`conv-out-${ee}`),R=[{tensor:e,type:`read-only-storage`},{tensor:A,type:`read-only-storage`}];return t.bias&&R.push({tensor:t.bias,type:`read-only-storage`}),F&&R.push({tensor:c,type:`read-only-storage`}),R.push({tensor:te,type:`storage`}),await u.runProgram({name:`conv2d`,source:L,cacheKey:ee,bindings:R,workgroups:y?[Math.ceil(r/T),Math.ceil(i*a/w),1]:E?[Math.ceil(r/32),Math.ceil(Math.ceil(i/2)*Math.ceil(a/2)/32),1]:D||O?[Math.ceil(r/64),Math.ceil(i*a/j),1]:[Math.ceil(i/8),Math.ceil(a/8),Math.ceil(r/d)]}),c&&!F&&await this._addInplace({yT:te,xT:c,count:r*i*a}),te}_canFuseUpsampleConv({inT:e,conv:t,inC:n,outC:r}){let i=this.rt;return i.caps().f16&&i.caps().adapter?.vendor===`apple`&&e.dtype===`float16`&&t.upsamplePackedKOutWeights&&n>=128&&r>=128&&r%4==0||i.caps().subgroupMatrix&&i.caps().f16&&e.dtype===`float16`&&t.weight?.dtype===`float16`&&n%32==0&&r%64==0?!0:i.caps().f16&&e.dtype===`float16`&&t.weight?.dtype===`float16`&&!!t.upsampleFusedWeights&&r%16==0}async _upsampleConv2d({inT:e,conv:t,inC:n,outC:r,H:i,W:a,outputDtype:o=`float16`}){let s=this.rt,c=e.dtype,l=t.bias?.dtype??`float32`,u=s.caps().f16&&c===`float16`&&t.upsamplePackedKOutWeights&&o===`float16`&&r%4==0&&n>=128&&r>=128,d=u&&s.caps().adapter?.vendor===`apple`,f=!d&&s.caps().subgroupMatrix&&s.caps().f16&&c===`float16`&&t.weight?.dtype===`float16`&&n%32==0&&r%64==0,p=!f&&u,m=r%128==0?128:64,h=r%16==0?16:r%8==0?8:r%4==0?4:1,g=d?96:32,_=d?12:4,v=d?32:64,y=s.empty(o,[r,i*2,a*2],`ups-conv-out`);for(let u=0;u<2;++u)for(let d=0;d<2;++d){let b=u*2+d,x=p?t.upsamplePackedKOutWeights[b]:t.upsampleFusedWeights?.[b]??t.weight,S=x!==t.weight,C=f?`sg_tn${m}`:p?`pkn4_tm${g}_tn16_rpt${_}_tk${v}`:`sw_ot${h}`,w=`ups_conv2d_${n}_${r}_${i}_${a}_${t.bias?`b`:`nb`}_${c}_${x.dtype}_${l}_${o}_${C}_${S?`fw`:`ow`}_py${u}_px${d}`,T=f?ai({inC:n,outC:r,H:i,W:a,hasBias:!!t.bias,inputDtype:c,weightDtype:x.dtype,biasDtype:l,outputDtype:o,tileN:m,phaseY:u,phaseX:d,fusedWeights:S}):p?ri({inC:n,outC:r,H:i,W:a,hasBias:!!t.bias,inputDtype:c,weightDtype:x.dtype,biasDtype:l,outputDtype:o,phaseY:u,phaseX:d,mTile:g,nTile:16,rowPerThread:_,kTile:v}):ni({inC:n,outC:r,H:i,W:a,hasBias:!!t.bias,inputDtype:c,weightDtype:x.dtype,biasDtype:l,outputDtype:o,outTile:h,phaseY:u,phaseX:d}),E=[{tensor:e,type:`read-only-storage`},{tensor:x,type:`read-only-storage`}];t.bias&&E.push({tensor:t.bias,type:`read-only-storage`}),E.push({tensor:y,type:`storage`}),await s.runProgram({name:`upsample_conv2d`,source:T,cacheKey:w,bindings:E,workgroups:f?[Math.ceil(r/m),Math.ceil(i*a/32),1]:p?[Math.ceil(r/64),Math.ceil(i*a/g),1]:[Math.ceil(i/8),Math.ceil(a/8),Math.ceil(r/h)]})}return y}async _groupnorm({inT:e,gn:t,C:n,H:r,W:i,groups:a,eps:o,applySilu:s=!1,outputDtype:c=`float32`}){let l=this.rt,u=e.dtype,d=t.weight.dtype,f=t.bias?.dtype??`float32`,p=l.empty(c,[n,r,i],`gn-out`),m=n/a*r*i;if(m>=131072){let h=u===`float16`&&m%4==0,g=h?8192:1024,_=Math.ceil(m/g),v=l.empty(`float32`,[a,_,2],`gn-partial`),y=l.empty(`float32`,[a,2],`gn-stats`);await l.runProgram({name:`groupnorm_reduce`,source:h?ci({C:n,H:r,W:i,groups:a,elementsPerWorkgroup:g}):si({C:n,H:r,W:i,groups:a,elementsPerWorkgroup:g,inputDtype:u}),cacheKey:`gn_reduce_${n}_${r}_${i}_${a}_${g}_${u}${h?`_v4`:``}`,bindings:[{tensor:e,type:`read-only-storage`},{tensor:v,type:`storage`}],workgroups:[_,a,1]}),await l.runProgram({name:`groupnorm_stats`,source:li({C:n,H:r,W:i,groups:a,eps:o,elementsPerWorkgroup:g}),cacheKey:`gn_stats_${n}_${r}_${i}_${a}_${o}_${g}`,bindings:[{tensor:v,type:`read-only-storage`},{tensor:y,type:`storage`}],workgroups:[a,1,1]});let b=n*r*i,x=u===`float16`&&d===`float16`&&f===`float16`&&c===`float16`&&r*i%4==0,S=x?b/4:b,C=Math.ceil(S/64),w=Math.min(C,1024),T=Math.ceil(C/w),E=l.createUniformU32([S,w,0,0],`gn-apply-params`);return await l.runProgram({name:s?`groupnorm_silu_apply`:`groupnorm_apply`,source:x?di({C:n,H:r,W:i,groups:a,applySilu:s}):ui({C:n,H:r,W:i,groups:a,applySilu:s,inputDtype:u,weightDtype:d,biasDtype:f,outputDtype:c}),cacheKey:`gn_apply_${n}_${r}_${i}_${a}_${s?`silu`:`linear`}_${u}_${d}_${f}_${c}${x?`_v4`:``}`,bindings:[{tensor:e,type:`read-only-storage`},{tensor:y,type:`read-only-storage`},{tensor:t.weight,type:`read-only-storage`},{tensor:t.bias,type:`read-only-storage`},{tensor:p,type:`storage`},{buffer:E,type:`uniform`}],workgroups:[w,T,1]}),p}let h=`gn_${n}_${r}_${i}_${a}_${o}_${s?`silu`:`linear`}_${u}_${d}_${f}_${c}`,g=oi({C:n,H:r,W:i,groups:a,eps:o,applySilu:s,inputDtype:u,weightDtype:d,biasDtype:f,outputDtype:c});return await l.runProgram({name:s?`groupnorm_silu`:`groupnorm`,source:g,cacheKey:h,bindings:[{tensor:e,type:`read-only-storage`},{tensor:t.weight,type:`read-only-storage`},{tensor:t.bias,type:`read-only-storage`},{tensor:p,type:`storage`}],workgroups:[a,1,1]}),p}async _addInplace({yT:e,xT:t,count:n}){let r=this.rt;if(e.dtype!==t.dtype)throw Error(`_addInplace dtype mismatch: y=${e.dtype} x=${t.dtype}`);let i=e.dtype,a=i===`float16`?`f16`:`f32`,o=i===`float16`?`enable f16;
`:``,s=`img_add_2d_${i}`,c=`${o}struct Params { count: u32, wgY: u32, _pad0: u32, _pad1: u32 };
@group(0) @binding(0) var<storage, read_write> y: array<${a}>;
@group(0) @binding(1) var<storage, read>       x: array<${a}>;
@group(0) @binding(2) var<uniform>             p: Params;
@compute @workgroup_size(64, 1, 1)
fn main(@builtin(workgroup_id) wg: vec3<u32>, @builtin(local_invocation_id) lid: vec3<u32>) {
  let wg_idx = wg.x + wg.y * p.wgY;
  let i = wg_idx * 64u + lid.x;
  if (i >= p.count) { return; }
  y[i] = y[i] + x[i];
}
`,l=Math.ceil(n/64),u=Math.min(l,1024),d=Math.ceil(l/u),f=r.createUniformU32([n,u,0,0],`img-add-params`);await r.runProgram({name:`img_add`,source:c,cacheKey:s,bindings:[{tensor:e,type:`storage`},{tensor:t,type:`read-only-storage`},{buffer:f,type:`uniform`}],workgroups:[u,d,1]})}async _resnet({inT:e,rn:t,inC:n,H:r,W:i}){let a=this.rt.caps().f16?`float16`:`float32`,o=await this._groupnorm({inT:e,gn:t.norm1,C:n,H:r,W:i,groups:32,eps:1e-6,applySilu:!0,outputDtype:a});o=await this._conv2d({inT:o,conv:t.conv1,inC:n,outC:t.outC,H:r,W:i,k:3,pad:1,outputDtype:a}),o=await this._groupnorm({inT:o,gn:t.norm2,C:t.outC,H:r,W:i,groups:32,eps:1e-6,applySilu:!0,outputDtype:a});let s=e;return t.conv_shortcut&&(s=await this._conv2d({inT:e,conv:t.conv_shortcut,inC:n,outC:t.outC,H:r,W:i,k:1,pad:0,outputDtype:a})),o=await this._conv2d({inT:o,conv:t.conv2,inC:t.outC,outC:t.outC,H:r,W:i,k:3,pad:1,addT:s,outputDtype:a}),o}async _attentionMid({inT:e,attn:t,C:n,H:r,W:i}){let a=this.rt,o=r*i,s=await this._groupnorm({inT:e,gn:t.group_norm,C:n,H:r,W:i,groups:32,eps:1e-6,outputDtype:a.caps().f16?`float16`:`float32`}),c=a.caps().f16?`float16`:`float32`,l=await this._conv2d({inT:s,conv:t.to_q,inC:n,outC:n,H:r,W:i,k:1,pad:0,outputDtype:c}),u=await this._conv2d({inT:s,conv:t.to_k,inC:n,outC:n,H:r,W:i,k:1,pad:0,outputDtype:c}),d=await this._conv2d({inT:s,conv:t.to_v,inC:n,outC:n,H:r,W:i,k:1,pad:0,outputDtype:c}),f=await this._transposeChwToNc({inT:l,C:n,H:r,W:i}),p=await this._transposeChwToNc({inT:u,C:n,H:r,W:i}),m=await this._transposeChwToNc({inT:d,C:n,H:r,W:i}),h=f,g=p,_=m;a.caps().f16&&f.dtype!==`float16`&&(h=a.empty(`float16`,[o,1,n],`vae-attn-q-f16`),g=a.empty(`float16`,[o,1,n],`vae-attn-k-f16`),_=a.empty(`float16`,[o,1,n],`vae-attn-v-f16`),await Bn(a,{xT:f,yT:h,count:o*n}),await Bn(a,{xT:p,yT:g,count:o*n}),await Bn(a,{xT:m,yT:_,count:o*n}));let v=a.empty(c,[o,1,n],`vae-attn-out`);if(a.caps().f16&&h.dtype===`float16`&&g.dtype===`float16`&&_.dtype===`float16`&&c===`float16`&&n===512&&o<=4096&&o%64==0){let e=a.empty(`float16`,[o,o],`vae-attn-logits`),t=a.caps().subgroupMatrix?g:await this._transposeNcToCn({inT:g,rows:o,cols:n});a.caps().subgroupMatrix?await or(a,{aT:h,wT:t,outT:e,M:o,inFeatures:n,outFeatures:o}):await ir(a,{aT:h,wT:t,outT:e,M:o,inFeatures:n,outFeatures:o}),await Hn(a,{xT:e,rows:o,cols:o,scale:1/Math.sqrt(n)});let r=await this._transposeNcToCn({inT:_,rows:o,cols:n});a.caps().subgroupMatrix?await or(a,{aT:e,wT:r,outT:v,M:o,inFeatures:o,outFeatures:n}):await ir(a,{aT:e,wT:r,outT:v,M:o,inFeatures:o,outFeatures:n})}else await Wn(a,{qT:h,kT:g,vT:_,outT:v,seq:o,qHeads:1,kvHeads:1,headDim:n,causal:!1});let y=await this._transposeNcToChw({inT:v,C:n,H:r,W:i});return await this._conv2d({inT:y,conv:t.to_out,inC:n,outC:n,H:r,W:i,k:1,pad:0,addT:e,outputDtype:c})}async _transposeChwToNc({inT:e,C:t,H:n,W:r}){let i=this.rt,a=n*r,o=e.dtype,s=o===`float16`?`f16`:`f32`,c=o===`float16`?`enable f16;
`:``,l=`t_chw_nc_${t}_${n}_${r}_${o}`,u=`${c}@group(0) @binding(0) var<storage, read>       x: array<${s}>;
@group(0) @binding(1) var<storage, read_write> y: array<${s}>;
const C: u32 = ${t}u;
const H: u32 = ${n}u;
const W: u32 = ${r}u;
const N: u32 = ${a}u;
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let h = gid.x; let w = gid.y; let c = gid.z;
  if (h >= H || w >= W || c >= C) { return; }
  let n_idx = h * W + w;
  y[n_idx * C + c] = x[c * N + n_idx];
}
`,d=i.empty(o,[a,t],`t-chw-nc`);return await i.runProgram({name:`t_chw_nc`,source:u,cacheKey:l,bindings:[{tensor:e,type:`read-only-storage`},{tensor:d,type:`storage`}],workgroups:[Math.ceil(n/8),Math.ceil(r/8),t]}),d}async _transposeNcToCn({inT:e,rows:t,cols:n}){let r=this.rt,i=e.dtype,a=i===`float16`?`f16`:`f32`,o=i===`float16`?`enable f16;
`:``,s=`t_nc_cn_${t}_${n}_${i}`,c=`${o}@group(0) @binding(0) var<storage, read>       x: array<${a}>;
@group(0) @binding(1) var<storage, read_write> y: array<${a}>;
const ROWS: u32 = ${t}u;
const COLS: u32 = ${n}u;
@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let c = gid.x;
  let r = gid.y;
  if (r >= ROWS || c >= COLS) { return; }
  y[c * ROWS + r] = x[r * COLS + c];
}
`,l=r.empty(i,[n,t],`vae-attn-v-cn`);return await r.runProgram({name:`t_nc_cn`,source:c,cacheKey:s,bindings:[{tensor:e,type:`read-only-storage`},{tensor:l,type:`storage`}],workgroups:[Math.ceil(n/16),Math.ceil(t/16),1]}),l}async _transposeNcToChw({inT:e,C:t,H:n,W:r}){let i=this.rt,a=n*r,o=e.dtype,s=o===`float16`?`f16`:`f32`,c=o===`float16`?`enable f16;
`:``,l=`t_nc_chw_${t}_${n}_${r}_${o}`,u=`${c}@group(0) @binding(0) var<storage, read>       x: array<${s}>;
@group(0) @binding(1) var<storage, read_write> y: array<${s}>;
const C: u32 = ${t}u;
const H: u32 = ${n}u;
const W: u32 = ${r}u;
const N: u32 = ${a}u;
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let h = gid.x; let w = gid.y; let c = gid.z;
  if (h >= H || w >= W || c >= C) { return; }
  let n_idx = h * W + w;
  y[c * N + n_idx] = x[n_idx * C + c];
}
`,d=i.empty(o,[t,n,r],`t-nc-chw`);return await i.runProgram({name:`t_nc_chw`,source:u,cacheKey:l,bindings:[{tensor:e,type:`read-only-storage`},{tensor:d,type:`storage`}],workgroups:[Math.ceil(n/8),Math.ceil(r/8),t]}),d}};function mi(e){if(e.byteLength%4==0)return e;let t=new Uint16Array(e.length+1);return t.set(e),t}function hi({rt:e,weightF16:t,inC:n,outC:r}){let i=bi(),a=[];for(let o=0;o<2;++o){let s=o===0?[[0],[1,2]]:[[0,1],[2]];for(let o=0;o<2;++o){let c=o===0?[[0],[1,2]]:[[0,1],[2]],l=new Uint16Array(r*n*4);for(let e=0;e<r;++e)for(let r=0;r<n;++r)for(let a=0;a<2;++a)for(let o=0;o<2;++o){let u=0;for(let l of s[a])for(let a of c[o])u+=i[t[e*n*9+r*9+l*3+a]];l[e*n*4+r*4+a*2+o]=It(u)}let u=mi(l);a.push(e.tensorFromTypedArray(`float16`,[u.length],u))}}return a}function gi({rt:e,weightF16:t,inC:n,outC:r}){let i=bi(),a=[];for(let o=0;o<2;++o){let s=o===0?[[0],[1,2]]:[[0,1],[2]];for(let o=0;o<2;++o){let c=o===0?[[0],[1,2]]:[[0,1],[2]],l=new Uint16Array(n*4*r);for(let e=0;e<n;++e)for(let a=0;a<2;++a)for(let o=0;o<2;++o){let u=a*2+o,d=(e*4+u)*r;for(let u=0;u<r;++u){let r=0;for(let l of s[a])for(let a of c[o])r+=i[t[u*n*9+e*9+l*3+a]];l[d+u]=It(r)}}let u=mi(l);a.push(e.tensorFromTypedArray(`float16`,[u.length],u))}}return a}function _i({rt:e,weightF16:t,inC:n,outC:r}){let i=new Uint16Array(r*9*n);for(let e=0;e<r;++e){let r=e*n*9;for(let e=0;e<9;++e){let a=r+e*n;for(let o=0;o<n;++o)i[a+o]=t[r+o*9+e]}}return e.tensorFromTypedArray(`float16`,[i.length],i)}async function vi({rt:e,weightF16:t,inC:n,outC:r}){let i=e.tensorFromTypedArray(`float16`,[t.length],t),a=e.empty(`float16`,[n*16,r],`conv-wino-f2x2-weight`);return await e.runProgram({name:`conv2d_winograd_weight_transform`,source:ei({inC:n,outC:r}),cacheKey:`conv2d_winograd_weight_transform_${n}_${r}`,bindings:[{tensor:i,type:`read-only-storage`},{tensor:a,type:`storage`}],workgroups:[Math.ceil(r/16),Math.ceil(n/16),1]}),e.clearBindGroupCache?.(),e.host.device.queue.onSubmittedWorkDone().then(()=>i.destroy?.()).catch(()=>{}),a}var yi=null;function bi(){if(yi)return yi;let e=new Float32Array(65536);for(let t=0;t<e.length;++t)e[t]=Ft(t);return yi=e,e}function xi(e){let t=new Float32Array(e*4);for(let n=0;n<e;++n)t[n*4+3]=n;return t}function Si(e,t){let n=new Float32Array(e*t*4);for(let r=0;r<e;++r)for(let e=0;e<t;++e){let i=(r*t+e)*4;n[i+1]=r,n[i+2]=e}return n}var Ci=class{constructor({rt:e,snapshotDir:t,tokenizer:n,textEncoder:r,transformer:i,vae:a,vaeConfig:o,schedulerConfig:s,bnStats:c}){this.rt=e,this.snapshotDir=t,this.tokenizer=n,this.textEncoder=r,this.transformer=i,this.vae=a,this.vaeConfig=o??a?.config??null,this.schedulerConfig=s,this.bnStats=c,this.destroyed=!1}async ensureVae(){if(this.vae&&this.bnStats)return this.vae;throw Error(`VAE was not loaded; construct the pipeline without skipVae to decode images`)}async generate(e){let t=Vt();try{return await this._generate(e,t)}finally{this.rt.clearTransientCaches?.(),this.rt.clearReadbackPool?.(),t.destroy(),this.rt.clearTransientCaches?.()}}async _generate({prompt:e,height:t=1024,width:n=1024,numInferenceSteps:r=4,seed:i=0,log:a=null,callbackOnStepEnd:o=null,encoderHiddenStatesT:s=null},c=null){if(t%16!=0||n%16!=0)throw Error(`height and width must be divisible by 16`);let l=this.rt,u=this.schedulerConfig,d=this.transformer.config;d.num_attention_heads*d.attention_head_dim;let f=s,p,m;if(f){if(f.runtime!==l)throw Error(`encoderHiddenStatesT belongs to a different runtime`);if(f.shape.length!==2)throw Error(`encoderHiddenStatesT must have shape [seq, stackDim]`);[p,m]=f.shape,a?.(`text encode cache`)}else ({hiddenStackT:f,seq:p,stackDim:m}=await this.encodePrompt(e,{log:a,scope:c}));if(m!==d.joint_attention_dim)throw Error(`text stackDim ${m} != joint_attention_dim ${d.joint_attention_dim}`);a?.(`scheduler`);let h=dr(t/16*(n/16),r),g=new pr(u);g.setTimesteps({numInferenceSteps:r,mu:h});let _=t/8,v=n/8,y=this.vaeConfig?.latent_channels??32,b=_/2,x=v/2,S=y*4,C=Ii(Fi(i,S*b*x),S,b,x),w=c?.track(l.tensorFromTypedArray(`float32`,[b*x,S],C))??l.tensorFromTypedArray(`float32`,[b*x,S],C),T=Si(b,x),E=xi(p);for(let e=0;e<r;++e){let t=Vt(),n=Ht(l,t);try{let i=g.timesteps[e]/1e3;a?.(`step ${e}/${r} t=${i.toFixed(4)}`);let s=await this.transformer.forward({hiddenStatesT:w,encoderHiddenStatesT:f,timestep:i,imgIds:T,txtIds:E,scope:t}),c=g.stepDelta(e);await Ln(n,{xT:w,yT:s,count:b*x*128,alpha:c}),o&&await o(this,e,g.timesteps[e],{latents:w})}finally{l.clearBindGroupCache?.(),t.destroy()}}await this.ensureVae(),a?.(`unpack + BN-denorm`);let D=await Rn(c?Ht(l,c):l,{packedT:w,meanT:this.bnStats.running_meanT,stdT:this.bnStats.running_stdT,outputDtype:l.caps().f16?`float16`:`float32`,latentC:y,latentH:_,latentW:v});a?.(`vae decode`);let{image:O,H:k,W:A}=await this.vae.decode(D,_,v,{scope:c}),j=await Ei(l,O);a?.(`to RGB`);let M=new Uint8Array(k*A*3);for(let e=0;e<3;e++)for(let t=0;t<k;t++)for(let n=0;n<A;n++){let r=(j[e*k*A+t*A+n]+1)*127.5;M[(t*A+n)*3+e]=Math.min(255,Math.max(0,Math.round(r)))}return a?.(`png encode`),br(A,k,M)}destroy(){this.destroyed||(this.destroyed=!0,this.rt.clearTransientCaches?.(),this.textEncoder?.destroy?.(),this.transformer?.destroy?.(),this.vae?.destroy?.(),this.tokenizer=null,this.textEncoder=null,this.transformer=null,this.vae=null,this.bnStats=null,this.rt.clearTransientCaches?.())}async encodePrompt(e,{log:t=null,scope:n=null}={}){if(!this.tokenizer||!this.textEncoder)throw Error(`Text encoder was not loaded; provide encoderHiddenStatesT to generate()`);t?.(`tokenize`);let r=Pi(e),i=(await this.tokenizer.encode(r)).ids.slice(0,512),a=new Uint32Array(Math.max(1,i.length));for(let e=0;e<i.length;++e)a[e]=i[e];return t?.(`tokens: ${i.length}`),t?.(`text encode`),this.textEncoder.encode(a,{scope:n})}},wi=class e extends Ci{static async fromSnapshot(t,n,r={}){return Ti(e,t,n,r,{readJsonResource:Di,readJsonResourceOptional:Oi,openSafeTensorsResource:ki})}};async function Ti(e,t,n,{onProgress:r=null,fetch:i=null,cacheStorage:a=null,cacheName:o=null,cache:s=void 0,force:c=!1,signal:l=null,skipTextEncoder:u=!1,skipVae:d=!1,requireRangeRequests:f=!0}={},p){let m={fetch:i,cacheStorage:a,cacheName:o,cache:s,force:c,signal:l,requireRangeRequests:f},h=null,g=null,_=null,v=e=>{r&&r({component:e,phase:`open`})},y=e=>t=>{r&&r({component:e,phase:`download`,...t})};try{r&&r({phase:`init`});let i=await p.readJsonResource(n,`scheduler/scheduler_config.json`,m),a=new At(await p.readJsonResource(n,`tokenizer/tokenizer.json`,m),await p.readJsonResource(n,`tokenizer/tokenizer_config.json`,m));if(!u){v(`text_encoder`);let e=await p.readJsonResource(n,`text_encoder-mlx-4bit/config.json`,m),r=await p.openSafeTensorsResource(n,`text_encoder-mlx-4bit/model.safetensors`,m);try{h=await cr.fromMlxSafeTensors({rt:t,config:e,safeTensors:r,onProgress:y(`text_encoder`),signal:l})}finally{await r.close()}}v(`transformer`);let o=await p.readJsonResource(n,`transformer-packed-mflux/config.json`,m),s=p.readJsonResourceOptional?await p.readJsonResourceOptional(n,`transformer-packed-mflux/quantization_config.json`,m):null,c=s?{...o,quantization_config:s}:o,f=await p.openSafeTensorsResource(n,`transformer-packed-mflux/diffusion_pytorch_model.safetensors`,m);try{g=await Nr.fromMlxSafeTensors({rt:t,config:c,safeTensors:f,onProgress:y(`transformer`),signal:l})}finally{await f.close()}let b=await p.readJsonResource(n,`vae/config.json`,m),x=null;if(!d){v(`vae`);let e=await p.openSafeTensorsResource(n,`vae/diffusion_pytorch_model.safetensors`,m);try{_=await pi.fromBf16SafeTensors({rt:t,config:b,safeTensors:e,onProgress:y(`vae`),signal:l}),x=_.w.bn}finally{await e.close()}}return new e({rt:t,snapshotDir:n,tokenizer:a,textEncoder:h,transformer:g,vae:_,vaeConfig:b,schedulerConfig:i,bnStats:x})}catch(e){throw h?.destroy?.(),g?.destroy?.(),_?.destroy?.(),t.clearTransientCaches?.(),e}}async function Ei(e,t){let n=await e.readTensor(t);return t.dtype===`float16`?Float32Array.from(n,Ft):n}async function Di(e,t,n){return JSON.parse(await ji(Ai(e,t),n))}async function Oi(e,t,n){try{return await Di(e,t,n)}catch{return null}}async function ki(e,t,n={}){return A(Ai(e,t),n)}function Ai(e,t){let n=e instanceof URL?e.toString():String(e);return new URL(t,Ni(n),globalThis.location?.href).toString()}async function ji(e,t={}){let n=t.fetch??globalThis.fetch;if(typeof n!=`function`)throw Error(`No fetch implementation available`);let r=await Mi(t);if(r&&!t.force){let t=await r.match(e);if(t)return t.text()}let i=await n(e,{signal:t.signal});if(!i.ok)throw Error(`GET ${e} failed: ${i.status} ${i.statusText}`);if(r)try{await r.put(e,i.clone())}catch(e){typeof console<`u`&&console.warn(`resource cache write failed: ${e.message}`)}return i.text()}async function Mi(e={}){if(e.cache===!1)return null;let t=e.cacheStorage??globalThis.caches;return t?.open?t.open(e.cacheName??`bonsai-pipeline-v1`):null}function Ni(e){return e.endsWith(`/`)?e:`${e}/`}function Pi(e){return`<|im_start|>user
${e}<|im_end|>
<|im_start|>assistant
<think>

</think>

`}function Fi(e,t){let n=e>>>0^3735928559;function r(){n=n+1831565813>>>0;let e=n;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),(e^e>>>14)>>>0}function i(){return(r()+1)/4294967297}let a=new Float32Array(t);for(let e=0;e<t;e+=2){let n=i(),r=i(),o=Math.sqrt(-2*Math.log(n)),s=2*Math.PI*r;a[e]=o*Math.cos(s),e+1<t&&(a[e+1]=o*Math.sin(s))}return a}function Ii(e,t,n,r){let i=n*r,a=new Float32Array(i*t);for(let n=0;n<t;++n)for(let r=0;r<i;++r)a[r*t+n]=e[n*i+r];return a}var Li=`https://huggingface.co`,Ri=`prism-ml/bonsai-image-ternary-4B-mlx-2bit`,zi=`bonsai-image-v1`,Bi=class e{constructor({runtime:e,pipeline:t,modelRoot:n,ownsRuntime:r}){this.runtime=e,this.gpuPipeline=t,this.modelRoot=n,this.ownsRuntime=r,this.destroyed=!1}static async from_pretrained(t=null,n={}){let r=Ui(t,n),i=n.runtime??n.rt??await a(n.runtimeOptions??{}),o=!(n.runtime??n.rt),s;try{s=await wi.fromSnapshot(i,r,{onProgress:n.onProgress,fetch:n.fetch,cacheStorage:n.cacheStorage,cacheName:n.cacheName??zi,cache:n.cache,force:n.force,signal:n.signal,requireRangeRequests:n.requireRangeRequests??n.require_range_requests??!0})}catch(e){if(o)try{await i.destroy()}catch{}throw e}return new e({runtime:i,pipeline:s,modelRoot:r,ownsRuntime:o})}async generate(e={}){let t=Hi(e);return new Vi({bytes:await this.gpuPipeline.generate(t),width:t.width,height:t.height,prompt:t.prompt,seed:t.seed})}async destroy(){if(this.destroyed)return;this.destroyed=!0;let e=this.gpuPipeline;this.gpuPipeline=null,e?.destroy?.(),this.ownsRuntime&&await this.runtime.destroy()}},Vi=class{constructor({bytes:e,width:t,height:n,prompt:r=``,seed:i=0}){this.bytes=e,this.width=t,this.height=n,this.prompt=r,this.seed=i}toBlob(){return new Blob([this.bytes],{type:`image/png`})}};function Hi(e){let t=e.prompt;if(typeof t!=`string`||t.length===0)throw Error(`Flux2KleinPipeline requires a non-empty prompt string`);if((e.guidanceScale??e.guidance_scale??1)!==1)throw Error(`Flux2-Klein Bonsai currently supports guidance_scale/guidanceScale = 1.0 only`);return{prompt:t,height:Number(e.height??1024),width:Number(e.width??1024),numInferenceSteps:Number(e.numInferenceSteps??e.num_inference_steps??4),seed:Number(e.seed??0),log:e.log??null,callbackOnStepEnd:e.callbackOnStepEnd??e.callback_on_step_end??null}}function Ui(e,t){let n=e??t.repoId??Ri;return Wi(n)||n.startsWith(`/`)||n.startsWith(`.`)?n:`${Li}/${n}/resolve/${t.revision??`main`}`}function Wi(e){return typeof e==`string`&&/^https?:/i.test(e)}var Gi={LEFT:0,MIDDLE:1,RIGHT:2,ROTATE:0,DOLLY:1,PAN:2},Ki={ROTATE:0,PAN:1,DOLLY_PAN:2,DOLLY_ROTATE:3},qi=1e3,Ji=1001,Yi=1002,Xi=1003,Zi=1004,Qi=1005,$i=1006,ea=1007,ta=1008,na=1009,ra=1010,ia=1011,aa=1012,oa=1013,sa=1014,ca=1015,la=1016,ua=1017,da=1018,fa=1020,pa=35902,ma=35899,ha=1021,ga=1022,_a=1023,va=1026,ya=1027,ba=1028,xa=1029,Sa=1030,Ca=1031,wa=1033,Ta=33776,Ea=33777,Da=33778,Oa=33779,ka=35840,Aa=35841,ja=35842,Ma=35843,Na=36196,Pa=37492,Fa=37496,Ia=37488,La=37489,Ra=37490,za=37491,Ba=37808,Va=37809,Ha=37810,Ua=37811,Wa=37812,Ga=37813,Ka=37814,qa=37815,Ja=37816,Ya=37817,Xa=37818,Za=37819,Qa=37820,$a=37821,eo=36492,to=36494,no=36495,ro=36283,io=36284,ao=36285,oo=36286,so=2300,co=2301,lo=2302,uo=2303,fo=2400,po=2401,mo=2402,ho=3200,go=`srgb`,_o=`srgb-linear`,vo=`linear`,yo=`srgb`,bo=7680,xo=35044,So=2e3;function Co(e){for(let t=e.length-1;t>=0;--t)if(e[t]>=65535)return!0;return!1}function wo(e){return ArrayBuffer.isView(e)&&!(e instanceof DataView)}function To(e){return document.createElementNS(`http://www.w3.org/1999/xhtml`,e)}function Eo(){let e=To(`canvas`);return e.style.display=`block`,e}var Do={},Oo=null;function ko(...e){let t=`THREE.`+e.shift();Oo?Oo(`log`,t,...e):console.log(t,...e)}function Ao(e){let t=e[0];if(typeof t==`string`&&t.startsWith(`TSL:`)){let t=e[1];t&&t.isStackTrace?e[0]+=` `+t.getLocation():e[1]=`Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.`}return e}function G(...e){e=Ao(e);let t=`THREE.`+e.shift();if(Oo)Oo(`warn`,t,...e);else{let n=e[0];n&&n.isStackTrace?console.warn(n.getError(t)):console.warn(t,...e)}}function K(...e){e=Ao(e);let t=`THREE.`+e.shift();if(Oo)Oo(`error`,t,...e);else{let n=e[0];n&&n.isStackTrace?console.error(n.getError(t)):console.error(t,...e)}}function jo(...e){let t=e.join(` `);t in Do||(Do[t]=!0,G(...e))}function Mo(e,t,n){return new Promise(function(r,i){function a(){switch(e.clientWaitSync(t,e.SYNC_FLUSH_COMMANDS_BIT,0)){case e.WAIT_FAILED:i();break;case e.TIMEOUT_EXPIRED:setTimeout(a,n);break;default:r()}}setTimeout(a,n)})}var No={0:1,2:6,4:7,3:5,1:0,6:2,7:4,5:3},Po=class{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});let n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){let n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){let n=this._listeners;if(n===void 0)return;let r=n[e];if(r!==void 0){let e=r.indexOf(t);e!==-1&&r.splice(e,1)}}dispatchEvent(e){let t=this._listeners;if(t===void 0)return;let n=t[e.type];if(n!==void 0){e.target=this;let t=n.slice(0);for(let n=0,r=t.length;n<r;n++)t[n].call(this,e);e.target=null}}},Fo=`00.01.02.03.04.05.06.07.08.09.0a.0b.0c.0d.0e.0f.10.11.12.13.14.15.16.17.18.19.1a.1b.1c.1d.1e.1f.20.21.22.23.24.25.26.27.28.29.2a.2b.2c.2d.2e.2f.30.31.32.33.34.35.36.37.38.39.3a.3b.3c.3d.3e.3f.40.41.42.43.44.45.46.47.48.49.4a.4b.4c.4d.4e.4f.50.51.52.53.54.55.56.57.58.59.5a.5b.5c.5d.5e.5f.60.61.62.63.64.65.66.67.68.69.6a.6b.6c.6d.6e.6f.70.71.72.73.74.75.76.77.78.79.7a.7b.7c.7d.7e.7f.80.81.82.83.84.85.86.87.88.89.8a.8b.8c.8d.8e.8f.90.91.92.93.94.95.96.97.98.99.9a.9b.9c.9d.9e.9f.a0.a1.a2.a3.a4.a5.a6.a7.a8.a9.aa.ab.ac.ad.ae.af.b0.b1.b2.b3.b4.b5.b6.b7.b8.b9.ba.bb.bc.bd.be.bf.c0.c1.c2.c3.c4.c5.c6.c7.c8.c9.ca.cb.cc.cd.ce.cf.d0.d1.d2.d3.d4.d5.d6.d7.d8.d9.da.db.dc.dd.de.df.e0.e1.e2.e3.e4.e5.e6.e7.e8.e9.ea.eb.ec.ed.ee.ef.f0.f1.f2.f3.f4.f5.f6.f7.f8.f9.fa.fb.fc.fd.fe.ff`.split(`.`),Io=1234567,Lo=Math.PI/180,Ro=180/Math.PI;function zo(){let e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0,r=Math.random()*4294967295|0;return(Fo[e&255]+Fo[e>>8&255]+Fo[e>>16&255]+Fo[e>>24&255]+`-`+Fo[t&255]+Fo[t>>8&255]+`-`+Fo[t>>16&15|64]+Fo[t>>24&255]+`-`+Fo[n&63|128]+Fo[n>>8&255]+`-`+Fo[n>>16&255]+Fo[n>>24&255]+Fo[r&255]+Fo[r>>8&255]+Fo[r>>16&255]+Fo[r>>24&255]).toLowerCase()}function Bo(e,t,n){return Math.max(t,Math.min(n,e))}function Vo(e,t){return(e%t+t)%t}function Ho(e,t,n,r,i){return r+(e-t)*(i-r)/(n-t)}function Uo(e,t,n){return e===t?0:(n-e)/(t-e)}function Wo(e,t,n){return(1-n)*e+n*t}function Go(e,t,n,r){return Wo(e,t,1-Math.exp(-n*r))}function Ko(e,t=1){return t-Math.abs(Vo(e,t*2)-t)}function qo(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*(3-2*e))}function Jo(e,t,n){return e<=t?0:e>=n?1:(e=(e-t)/(n-t),e*e*e*(e*(e*6-15)+10))}function Yo(e,t){return e+Math.floor(Math.random()*(t-e+1))}function Xo(e,t){return e+Math.random()*(t-e)}function Zo(e){return e*(.5-Math.random())}function Qo(e){e!==void 0&&(Io=e);let t=Io+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}function $o(e){return e*Lo}function es(e){return e*Ro}function ts(e){return(e&e-1)==0&&e!==0}function ns(e){return 2**Math.ceil(Math.log(e)/Math.LN2)}function rs(e){return 2**Math.floor(Math.log(e)/Math.LN2)}function is(e,t,n,r,i){let a=Math.cos,o=Math.sin,s=a(n/2),c=o(n/2),l=a((t+r)/2),u=o((t+r)/2),d=a((t-r)/2),f=o((t-r)/2),p=a((r-t)/2),m=o((r-t)/2);switch(i){case`XYX`:e.set(s*u,c*d,c*f,s*l);break;case`YZY`:e.set(c*f,s*u,c*d,s*l);break;case`ZXZ`:e.set(c*d,c*f,s*u,s*l);break;case`XZX`:e.set(s*u,c*m,c*p,s*l);break;case`YXY`:e.set(c*p,s*u,c*m,s*l);break;case`ZYZ`:e.set(c*m,c*p,s*u,s*l);break;default:G(`MathUtils: .setQuaternionFromProperEuler() encountered an unknown order: `+i)}}function as(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return e/4294967295;case Uint16Array:return e/65535;case Uint8Array:return e/255;case Int32Array:return Math.max(e/2147483647,-1);case Int16Array:return Math.max(e/32767,-1);case Int8Array:return Math.max(e/127,-1);default:throw Error(`Invalid component type.`)}}function os(e,t){switch(t.constructor){case Float32Array:return e;case Uint32Array:return Math.round(e*4294967295);case Uint16Array:return Math.round(e*65535);case Uint8Array:return Math.round(e*255);case Int32Array:return Math.round(e*2147483647);case Int16Array:return Math.round(e*32767);case Int8Array:return Math.round(e*127);default:throw Error(`Invalid component type.`)}}var ss={DEG2RAD:Lo,RAD2DEG:Ro,generateUUID:zo,clamp:Bo,euclideanModulo:Vo,mapLinear:Ho,inverseLerp:Uo,lerp:Wo,damp:Go,pingpong:Ko,smoothstep:qo,smootherstep:Jo,randInt:Yo,randFloat:Xo,randFloatSpread:Zo,seededRandom:Qo,degToRad:$o,radToDeg:es,isPowerOfTwo:ts,ceilPowerOfTwo:ns,floorPowerOfTwo:rs,setQuaternionFromProperEuler:is,normalize:os,denormalize:as},q=class e{static{e.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw Error(`index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw Error(`index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){let t=this.x,n=this.y,r=e.elements;return this.x=r[0]*t+r[3]*n+r[6],this.y=r[1]*t+r[4]*n+r[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=Bo(this.x,e.x,t.x),this.y=Bo(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=Bo(this.x,e,t),this.y=Bo(this.y,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Bo(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(Bo(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){let n=Math.cos(t),r=Math.sin(t),i=this.x-e.x,a=this.y-e.y;return this.x=i*n-a*r+e.x,this.y=i*r+a*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}},cs=class{constructor(e=0,t=0,n=0,r=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=r}static slerpFlat(e,t,n,r,i,a,o){let s=n[r+0],c=n[r+1],l=n[r+2],u=n[r+3],d=i[a+0],f=i[a+1],p=i[a+2],m=i[a+3];if(u!==m||s!==d||c!==f||l!==p){let e=s*d+c*f+l*p+u*m;e<0&&(d=-d,f=-f,p=-p,m=-m,e=-e);let t=1-o;if(e<.9995){let n=Math.acos(e),r=Math.sin(n);t=Math.sin(t*n)/r,o=Math.sin(o*n)/r,s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o}else{s=s*t+d*o,c=c*t+f*o,l=l*t+p*o,u=u*t+m*o;let e=1/Math.sqrt(s*s+c*c+l*l+u*u);s*=e,c*=e,l*=e,u*=e}}e[t]=s,e[t+1]=c,e[t+2]=l,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,r,i,a){let o=n[r],s=n[r+1],c=n[r+2],l=n[r+3],u=i[a],d=i[a+1],f=i[a+2],p=i[a+3];return e[t]=o*p+l*u+s*f-c*d,e[t+1]=s*p+l*d+c*u-o*f,e[t+2]=c*p+l*f+o*d-s*u,e[t+3]=l*p-o*u-s*d-c*f,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,r){return this._x=e,this._y=t,this._z=n,this._w=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){let n=e._x,r=e._y,i=e._z,a=e._order,o=Math.cos,s=Math.sin,c=o(n/2),l=o(r/2),u=o(i/2),d=s(n/2),f=s(r/2),p=s(i/2);switch(a){case`XYZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`YXZ`:this._x=d*l*u+c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`ZXY`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u-d*f*p;break;case`ZYX`:this._x=d*l*u-c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u+d*f*p;break;case`YZX`:this._x=d*l*u+c*f*p,this._y=c*f*u+d*l*p,this._z=c*l*p-d*f*u,this._w=c*l*u-d*f*p;break;case`XZY`:this._x=d*l*u-c*f*p,this._y=c*f*u-d*l*p,this._z=c*l*p+d*f*u,this._w=c*l*u+d*f*p;break;default:G(`Quaternion: .setFromEuler() encountered an unknown order: `+a)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){let n=t/2,r=Math.sin(n);return this._x=e.x*r,this._y=e.y*r,this._z=e.z*r,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){let t=e.elements,n=t[0],r=t[4],i=t[8],a=t[1],o=t[5],s=t[9],c=t[2],l=t[6],u=t[10],d=n+o+u;if(d>0){let e=.5/Math.sqrt(d+1);this._w=.25/e,this._x=(l-s)*e,this._y=(i-c)*e,this._z=(a-r)*e}else if(n>o&&n>u){let e=2*Math.sqrt(1+n-o-u);this._w=(l-s)/e,this._x=.25*e,this._y=(r+a)/e,this._z=(i+c)/e}else if(o>u){let e=2*Math.sqrt(1+o-n-u);this._w=(i-c)/e,this._x=(r+a)/e,this._y=.25*e,this._z=(s+l)/e}else{let e=2*Math.sqrt(1+u-n-o);this._w=(a-r)/e,this._x=(i+c)/e,this._y=(s+l)/e,this._z=.25*e}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs(Bo(this.dot(e),-1,1)))}rotateTowards(e,t){let n=this.angleTo(e);if(n===0)return this;let r=Math.min(1,t/n);return this.slerp(e,r),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x*=e,this._y*=e,this._z*=e,this._w*=e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=t._x,s=t._y,c=t._z,l=t._w;return this._x=n*l+a*o+r*c-i*s,this._y=r*l+a*s+i*o-n*c,this._z=i*l+a*c+n*s-r*o,this._w=a*l-n*o-r*s-i*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,r=e._y,i=e._z,a=e._w,o=this.dot(e);o<0&&(n=-n,r=-r,i=-i,a=-a,o=-o);let s=1-t;if(o<.9995){let e=Math.acos(o),c=Math.sin(e);s=Math.sin(s*e)/c,t=Math.sin(t*e)/c,this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this._onChangeCallback()}else this._x=this._x*s+n*t,this._y=this._y*s+r*t,this._z=this._z*s+i*t,this._w=this._w*s+a*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){let e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),r=Math.sqrt(1-n),i=Math.sqrt(n);return this.set(r*Math.sin(e),r*Math.cos(e),i*Math.sin(t),i*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}},J=class e{static{e.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw Error(`index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error(`index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(us.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(us.setFromAxisAngle(e,t))}applyMatrix3(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[3]*n+i[6]*r,this.y=i[1]*t+i[4]*n+i[7]*r,this.z=i[2]*t+i[5]*n+i[8]*r,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=e.elements,a=1/(i[3]*t+i[7]*n+i[11]*r+i[15]);return this.x=(i[0]*t+i[4]*n+i[8]*r+i[12])*a,this.y=(i[1]*t+i[5]*n+i[9]*r+i[13])*a,this.z=(i[2]*t+i[6]*n+i[10]*r+i[14])*a,this}applyQuaternion(e){let t=this.x,n=this.y,r=this.z,i=e.x,a=e.y,o=e.z,s=e.w,c=2*(a*r-o*n),l=2*(o*t-i*r),u=2*(i*n-a*t);return this.x=t+s*c+a*u-o*l,this.y=n+s*l+o*c-i*u,this.z=r+s*u+i*l-a*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){let t=this.x,n=this.y,r=this.z,i=e.elements;return this.x=i[0]*t+i[4]*n+i[8]*r,this.y=i[1]*t+i[5]*n+i[9]*r,this.z=i[2]*t+i[6]*n+i[10]*r,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=Bo(this.x,e.x,t.x),this.y=Bo(this.y,e.y,t.y),this.z=Bo(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=Bo(this.x,e,t),this.y=Bo(this.y,e,t),this.z=Bo(this.z,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Bo(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){let n=e.x,r=e.y,i=e.z,a=t.x,o=t.y,s=t.z;return this.x=r*s-i*o,this.y=i*a-n*s,this.z=n*o-r*a,this}projectOnVector(e){let t=e.lengthSq();if(t===0)return this.set(0,0,0);let n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return ls.copy(this).projectOnVector(e),this.sub(ls)}reflect(e){return this.sub(ls.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){let t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;let n=this.dot(e)/t;return Math.acos(Bo(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){let t=this.x-e.x,n=this.y-e.y,r=this.z-e.z;return t*t+n*n+r*r}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){let r=Math.sin(t)*e;return this.x=r*Math.sin(n),this.y=Math.cos(t)*e,this.z=r*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){let t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),r=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=r,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}},ls=new J,us=new cs,Y=class e{static{e.prototype.isMatrix3=!0}constructor(e,t,n,r,i,a,o,s,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c)}set(e,t,n,r,i,a,o,s,c){let l=this.elements;return l[0]=e,l[1]=r,l[2]=o,l[3]=t,l[4]=i,l[5]=s,l[6]=n,l[7]=a,l[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){let t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[3],s=n[6],c=n[1],l=n[4],u=n[7],d=n[2],f=n[5],p=n[8],m=r[0],h=r[3],g=r[6],_=r[1],v=r[4],y=r[7],b=r[2],x=r[5],S=r[8];return i[0]=a*m+o*_+s*b,i[3]=a*h+o*v+s*x,i[6]=a*g+o*y+s*S,i[1]=c*m+l*_+u*b,i[4]=c*h+l*v+u*x,i[7]=c*g+l*y+u*S,i[2]=d*m+f*_+p*b,i[5]=d*h+f*v+p*x,i[8]=d*g+f*y+p*S,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8];return t*a*l-t*o*c-n*i*l+n*o*s+r*i*c-r*a*s}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=l*a-o*c,d=o*s-l*i,f=c*i-a*s,p=t*u+n*d+r*f;if(p===0)return this.set(0,0,0,0,0,0,0,0,0);let m=1/p;return e[0]=u*m,e[1]=(r*c-l*n)*m,e[2]=(o*n-r*a)*m,e[3]=d*m,e[4]=(l*t-r*s)*m,e[5]=(r*i-o*t)*m,e[6]=f*m,e[7]=(n*s-c*t)*m,e[8]=(a*t-n*i)*m,this}transpose(){let e,t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){let t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,r,i,a,o){let s=Math.cos(i),c=Math.sin(i);return this.set(n*s,n*c,-n*(s*a+c*o)+a+e,-r*c,r*s,-r*(-c*a+s*o)+o+t,0,0,1),this}scale(e,t){return this.premultiply(ds.makeScale(e,t)),this}rotate(e){return this.premultiply(ds.makeRotation(-e)),this}translate(e,t){return this.premultiply(ds.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<9;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}},ds=new Y,fs=new Y().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),ps=new Y().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function ms(){let e={enabled:!0,workingColorSpace:_o,spaces:{},convert:function(e,t,n){return this.enabled===!1||t===n||!t||!n?e:(this.spaces[t].transfer===`srgb`&&(e.r=gs(e.r),e.g=gs(e.g),e.b=gs(e.b)),this.spaces[t].primaries!==this.spaces[n].primaries&&(e.applyMatrix3(this.spaces[t].toXYZ),e.applyMatrix3(this.spaces[n].fromXYZ)),this.spaces[n].transfer===`srgb`&&(e.r=_s(e.r),e.g=_s(e.g),e.b=_s(e.b)),e)},workingToColorSpace:function(e,t){return this.convert(e,this.workingColorSpace,t)},colorSpaceToWorking:function(e,t){return this.convert(e,t,this.workingColorSpace)},getPrimaries:function(e){return this.spaces[e].primaries},getTransfer:function(e){return e===``?vo:this.spaces[e].transfer},getToneMappingMode:function(e){return this.spaces[e].outputColorSpaceConfig.toneMappingMode||`standard`},getLuminanceCoefficients:function(e,t=this.workingColorSpace){return e.fromArray(this.spaces[t].luminanceCoefficients)},define:function(e){Object.assign(this.spaces,e)},_getMatrix:function(e,t,n){return e.copy(this.spaces[t].toXYZ).multiply(this.spaces[n].fromXYZ)},_getDrawingBufferColorSpace:function(e){return this.spaces[e].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(e=this.workingColorSpace){return this.spaces[e].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(t,n){return jo(`ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace().`),e.workingToColorSpace(t,n)},toWorkingColorSpace:function(t,n){return jo(`ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking().`),e.colorSpaceToWorking(t,n)}},t=[.64,.33,.3,.6,.15,.06],n=[.2126,.7152,.0722],r=[.3127,.329];return e.define({[_o]:{primaries:t,whitePoint:r,transfer:vo,toXYZ:fs,fromXYZ:ps,luminanceCoefficients:n,workingColorSpaceConfig:{unpackColorSpace:go},outputColorSpaceConfig:{drawingBufferColorSpace:go}},[go]:{primaries:t,whitePoint:r,transfer:yo,toXYZ:fs,fromXYZ:ps,luminanceCoefficients:n,outputColorSpaceConfig:{drawingBufferColorSpace:go}}}),e}var hs=ms();function gs(e){return e<.04045?e*.0773993808:(e*.9478672986+.0521327014)**2.4}function _s(e){return e<.0031308?e*12.92:1.055*e**.41666-.055}var vs,ys=class{static getDataURL(e,t=`image/png`){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>`u`)return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{vs===void 0&&(vs=To(`canvas`)),vs.width=e.width,vs.height=e.height;let t=vs.getContext(`2d`);e instanceof ImageData?t.putImageData(e,0,0):t.drawImage(e,0,0,e.width,e.height),n=vs}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap){let t=To(`canvas`);t.width=e.width,t.height=e.height;let n=t.getContext(`2d`);n.drawImage(e,0,0,e.width,e.height);let r=n.getImageData(0,0,e.width,e.height),i=r.data;for(let e=0;e<i.length;e++)i[e]=gs(i[e]/255)*255;return n.putImageData(r,0,0),t}else if(e.data){let t=e.data.slice(0);for(let e=0;e<t.length;e++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[e]=Math.floor(gs(t[e]/255)*255):t[e]=gs(t[e]);return{data:t,width:e.width,height:e.height}}else return G(`ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied.`),e}},bs=0,xs=class{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:bs++}),this.uuid=zo(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){let t=this.data;return typeof HTMLVideoElement<`u`&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<`u`&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t===null?e.set(0,0,0):e.set(t.width,t.height,t.depth||0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];let n={uuid:this.uuid,url:``},r=this.data;if(r!==null){let e;if(Array.isArray(r)){e=[];for(let t=0,n=r.length;t<n;t++)r[t].isDataTexture?e.push(Ss(r[t].image)):e.push(Ss(r[t]))}else e=Ss(r);n.url=e}return t||(e.images[this.uuid]=n),n}};function Ss(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap?ys.getDataURL(e):e.data?{data:Array.from(e.data),width:e.width,height:e.height,type:e.data.constructor.name}:(G(`Texture: Unable to serialize Texture.`),{})}var Cs=0,ws=new J,Ts=class e extends Po{constructor(t=e.DEFAULT_IMAGE,n=e.DEFAULT_MAPPING,r=Ji,i=Ji,a=$i,o=ta,s=_a,c=na,l=e.DEFAULT_ANISOTROPY,u=``){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Cs++}),this.uuid=zo(),this.name=``,this.source=new xs(t),this.mipmaps=[],this.mapping=n,this.channel=0,this.wrapS=r,this.wrapT=i,this.magFilter=a,this.minFilter=o,this.anisotropy=l,this.format=s,this.internalFormat=null,this.type=c,this.offset=new q(0,0),this.repeat=new q(1,1),this.center=new q(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Y,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=u,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(ws).x}get height(){return this.source.getSize(ws).y}get depth(){return this.source.getSize(ws).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(let t in e){let n=e[t];if(n===void 0){G(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){G(`Texture.setValues(): property '${t}' does not exist.`);continue}r&&n&&r.isVector2&&n.isVector2||r&&n&&r.isVector3&&n.isVector3||r&&n&&r.isMatrix3&&n.isMatrix3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];let n={metadata:{version:4.7,type:`Texture`,generator:`Texture.toJSON`},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:`dispose`})}transformUv(e){if(this.mapping!==300)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case qi:e.x-=Math.floor(e.x);break;case Ji:e.x=e.x<0?0:1;break;case Yi:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x-=Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case qi:e.y-=Math.floor(e.y);break;case Ji:e.y=e.y<0?0:1;break;case Yi:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y-=Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}};Ts.DEFAULT_IMAGE=null,Ts.DEFAULT_MAPPING=300,Ts.DEFAULT_ANISOTROPY=1;var Es=class e{static{e.prototype.isVector4=!0}constructor(e=0,t=0,n=0,r=1){this.x=e,this.y=t,this.z=n,this.w=r}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,r){return this.x=e,this.y=t,this.z=n,this.w=r,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw Error(`index is out of range: `+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error(`index is out of range: `+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w===void 0?1:e.w,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){let t=this.x,n=this.y,r=this.z,i=this.w,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*r+a[12]*i,this.y=a[1]*t+a[5]*n+a[9]*r+a[13]*i,this.z=a[2]*t+a[6]*n+a[10]*r+a[14]*i,this.w=a[3]*t+a[7]*n+a[11]*r+a[15]*i,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);let t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,r,i,a=.01,o=.1,s=e.elements,c=s[0],l=s[4],u=s[8],d=s[1],f=s[5],p=s[9],m=s[2],h=s[6],g=s[10];if(Math.abs(l-d)<a&&Math.abs(u-m)<a&&Math.abs(p-h)<a){if(Math.abs(l+d)<o&&Math.abs(u+m)<o&&Math.abs(p+h)<o&&Math.abs(c+f+g-3)<o)return this.set(1,0,0,0),this;t=Math.PI;let e=(c+1)/2,s=(f+1)/2,_=(g+1)/2,v=(l+d)/4,y=(u+m)/4,b=(p+h)/4;return e>s&&e>_?e<a?(n=0,r=.707106781,i=.707106781):(n=Math.sqrt(e),r=v/n,i=y/n):s>_?s<a?(n=.707106781,r=0,i=.707106781):(r=Math.sqrt(s),n=v/r,i=b/r):_<a?(n=.707106781,r=.707106781,i=0):(i=Math.sqrt(_),n=y/i,r=b/i),this.set(n,r,i,t),this}let _=Math.sqrt((h-p)*(h-p)+(u-m)*(u-m)+(d-l)*(d-l));return Math.abs(_)<.001&&(_=1),this.x=(h-p)/_,this.y=(u-m)/_,this.z=(d-l)/_,this.w=Math.acos((c+f+g-1)/2),this}setFromMatrixPosition(e){let t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=Bo(this.x,e.x,t.x),this.y=Bo(this.y,e.y,t.y),this.z=Bo(this.z,e.z,t.z),this.w=Bo(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=Bo(this.x,e,t),this.y=Bo(this.y,e,t),this.z=Bo(this.z,e,t),this.w=Bo(this.w,e,t),this}clampLength(e,t){let n=this.length();return this.divideScalar(n||1).multiplyScalar(Bo(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}},Ds=class extends Po{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:$i,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new Es(0,0,e,t),this.scissorTest=!1,this.viewport=new Es(0,0,e,t),this.textures=[];let r=new Ts({width:e,height:t,depth:n.depth}),i=n.count;for(let e=0;e<i;e++)this.textures[e]=r.clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(e={}){let t={minFilter:$i,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let e=0;e<this.textures.length;e++)this.textures[e].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let r=0,i=this.textures.length;r<i;r++)this.textures[r].image.width=e,this.textures[r].image.height=t,this.textures[r].image.depth=n,this.textures[r].isData3DTexture!==!0&&(this.textures[r].isArrayTexture=this.textures[r].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;let n=Object.assign({},e.textures[t].image);this.textures[t].source=new xs(n)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this}dispose(){this.dispatchEvent({type:`dispose`})}},Os=class extends Ds{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}},ks=class extends Ts{constructor(e=null,t=1,n=1,r=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=Xi,this.minFilter=Xi,this.wrapR=Ji,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}},As=class extends Ts{constructor(e=null,t=1,n=1,r=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:r},this.magFilter=Xi,this.minFilter=Xi,this.wrapR=Ji,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},js=class e{static{e.prototype.isMatrix4=!0}constructor(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h)}set(e,t,n,r,i,a,o,s,c,l,u,d,f,p,m,h){let g=this.elements;return g[0]=e,g[4]=t,g[8]=n,g[12]=r,g[1]=i,g[5]=a,g[9]=o,g[13]=s,g[2]=c,g[6]=l,g[10]=u,g[14]=d,g[3]=f,g[7]=p,g[11]=m,g[15]=h,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new e().fromArray(this.elements)}copy(e){let t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){let t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){let t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinant()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinant()===0)return this.identity();let t=this.elements,n=e.elements,r=1/Ms.setFromMatrixColumn(e,0).length(),i=1/Ms.setFromMatrixColumn(e,1).length(),a=1/Ms.setFromMatrixColumn(e,2).length();return t[0]=n[0]*r,t[1]=n[1]*r,t[2]=n[2]*r,t[3]=0,t[4]=n[4]*i,t[5]=n[5]*i,t[6]=n[6]*i,t[7]=0,t[8]=n[8]*a,t[9]=n[9]*a,t[10]=n[10]*a,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){let t=this.elements,n=e.x,r=e.y,i=e.z,a=Math.cos(n),o=Math.sin(n),s=Math.cos(r),c=Math.sin(r),l=Math.cos(i),u=Math.sin(i);if(e.order===`XYZ`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=-s*u,t[8]=c,t[1]=n+r*c,t[5]=e-i*c,t[9]=-o*s,t[2]=i-e*c,t[6]=r+n*c,t[10]=a*s}else if(e.order===`YXZ`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e+i*o,t[4]=r*o-n,t[8]=a*c,t[1]=a*u,t[5]=a*l,t[9]=-o,t[2]=n*o-r,t[6]=i+e*o,t[10]=a*s}else if(e.order===`ZXY`){let e=s*l,n=s*u,r=c*l,i=c*u;t[0]=e-i*o,t[4]=-a*u,t[8]=r+n*o,t[1]=n+r*o,t[5]=a*l,t[9]=i-e*o,t[2]=-a*c,t[6]=o,t[10]=a*s}else if(e.order===`ZYX`){let e=a*l,n=a*u,r=o*l,i=o*u;t[0]=s*l,t[4]=r*c-n,t[8]=e*c+i,t[1]=s*u,t[5]=i*c+e,t[9]=n*c-r,t[2]=-c,t[6]=o*s,t[10]=a*s}else if(e.order===`YZX`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=i-e*u,t[8]=r*u+n,t[1]=u,t[5]=a*l,t[9]=-o*l,t[2]=-c*l,t[6]=n*u+r,t[10]=e-i*u}else if(e.order===`XZY`){let e=a*s,n=a*c,r=o*s,i=o*c;t[0]=s*l,t[4]=-u,t[8]=c*l,t[1]=e*u+i,t[5]=a*l,t[9]=n*u-r,t[2]=r*u-n,t[6]=o*l,t[10]=i*u+e}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Ps,e,Fs)}lookAt(e,t,n){let r=this.elements;return Rs.subVectors(e,t),Rs.lengthSq()===0&&(Rs.z=1),Rs.normalize(),Is.crossVectors(n,Rs),Is.lengthSq()===0&&(Math.abs(n.z)===1?Rs.x+=1e-4:Rs.z+=1e-4,Rs.normalize(),Is.crossVectors(n,Rs)),Is.normalize(),Ls.crossVectors(Rs,Is),r[0]=Is.x,r[4]=Ls.x,r[8]=Rs.x,r[1]=Is.y,r[5]=Ls.y,r[9]=Rs.y,r[2]=Is.z,r[6]=Ls.z,r[10]=Rs.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){let n=e.elements,r=t.elements,i=this.elements,a=n[0],o=n[4],s=n[8],c=n[12],l=n[1],u=n[5],d=n[9],f=n[13],p=n[2],m=n[6],h=n[10],g=n[14],_=n[3],v=n[7],y=n[11],b=n[15],x=r[0],S=r[4],C=r[8],w=r[12],T=r[1],E=r[5],D=r[9],O=r[13],k=r[2],A=r[6],j=r[10],M=r[14],N=r[3],P=r[7],F=r[11],I=r[15];return i[0]=a*x+o*T+s*k+c*N,i[4]=a*S+o*E+s*A+c*P,i[8]=a*C+o*D+s*j+c*F,i[12]=a*w+o*O+s*M+c*I,i[1]=l*x+u*T+d*k+f*N,i[5]=l*S+u*E+d*A+f*P,i[9]=l*C+u*D+d*j+f*F,i[13]=l*w+u*O+d*M+f*I,i[2]=p*x+m*T+h*k+g*N,i[6]=p*S+m*E+h*A+g*P,i[10]=p*C+m*D+h*j+g*F,i[14]=p*w+m*O+h*M+g*I,i[3]=_*x+v*T+y*k+b*N,i[7]=_*S+v*E+y*A+b*P,i[11]=_*C+v*D+y*j+b*F,i[15]=_*w+v*O+y*M+b*I,this}multiplyScalar(e){let t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){let e=this.elements,t=e[0],n=e[4],r=e[8],i=e[12],a=e[1],o=e[5],s=e[9],c=e[13],l=e[2],u=e[6],d=e[10],f=e[14],p=e[3],m=e[7],h=e[11],g=e[15],_=s*f-c*d,v=o*f-c*u,y=o*d-s*u,b=a*f-c*l,x=a*d-s*l,S=a*u-o*l;return t*(m*_-h*v+g*y)-n*(p*_-h*b+g*x)+r*(p*v-m*b+g*S)-i*(p*y-m*x+h*S)}transpose(){let e=this.elements,t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){let r=this.elements;return e.isVector3?(r[12]=e.x,r[13]=e.y,r[14]=e.z):(r[12]=e,r[13]=t,r[14]=n),this}invert(){let e=this.elements,t=e[0],n=e[1],r=e[2],i=e[3],a=e[4],o=e[5],s=e[6],c=e[7],l=e[8],u=e[9],d=e[10],f=e[11],p=e[12],m=e[13],h=e[14],g=e[15],_=t*o-n*a,v=t*s-r*a,y=t*c-i*a,b=n*s-r*o,x=n*c-i*o,S=r*c-i*s,C=l*m-u*p,w=l*h-d*p,T=l*g-f*p,E=u*h-d*m,D=u*g-f*m,O=d*g-f*h,k=_*O-v*D+y*E+b*T-x*w+S*C;if(k===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let A=1/k;return e[0]=(o*O-s*D+c*E)*A,e[1]=(r*D-n*O-i*E)*A,e[2]=(m*S-h*x+g*b)*A,e[3]=(d*x-u*S-f*b)*A,e[4]=(s*T-a*O-c*w)*A,e[5]=(t*O-r*T+i*w)*A,e[6]=(h*y-p*S-g*v)*A,e[7]=(l*S-d*y+f*v)*A,e[8]=(a*D-o*T+c*C)*A,e[9]=(n*T-t*D-i*C)*A,e[10]=(p*x-m*y+g*_)*A,e[11]=(u*y-l*x-f*_)*A,e[12]=(o*w-a*E-s*C)*A,e[13]=(t*E-n*w+r*C)*A,e[14]=(m*v-p*b-h*_)*A,e[15]=(l*b-u*v+d*_)*A,this}scale(e){let t=this.elements,n=e.x,r=e.y,i=e.z;return t[0]*=n,t[4]*=r,t[8]*=i,t[1]*=n,t[5]*=r,t[9]*=i,t[2]*=n,t[6]*=r,t[10]*=i,t[3]*=n,t[7]*=r,t[11]*=i,this}getMaxScaleOnAxis(){let e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],r=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,r))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){let t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){let t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){let n=Math.cos(t),r=Math.sin(t),i=1-n,a=e.x,o=e.y,s=e.z,c=i*a,l=i*o;return this.set(c*a+n,c*o-r*s,c*s+r*o,0,c*o+r*s,l*o+n,l*s-r*a,0,c*s-r*o,l*s+r*a,i*s*s+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,r,i,a){return this.set(1,n,i,0,e,1,a,0,t,r,1,0,0,0,0,1),this}compose(e,t,n){let r=this.elements,i=t._x,a=t._y,o=t._z,s=t._w,c=i+i,l=a+a,u=o+o,d=i*c,f=i*l,p=i*u,m=a*l,h=a*u,g=o*u,_=s*c,v=s*l,y=s*u,b=n.x,x=n.y,S=n.z;return r[0]=(1-(m+g))*b,r[1]=(f+y)*b,r[2]=(p-v)*b,r[3]=0,r[4]=(f-y)*x,r[5]=(1-(d+g))*x,r[6]=(h+_)*x,r[7]=0,r[8]=(p+v)*S,r[9]=(h-_)*S,r[10]=(1-(d+m))*S,r[11]=0,r[12]=e.x,r[13]=e.y,r[14]=e.z,r[15]=1,this}decompose(e,t,n){let r=this.elements;e.x=r[12],e.y=r[13],e.z=r[14];let i=this.determinant();if(i===0)return n.set(1,1,1),t.identity(),this;let a=Ms.set(r[0],r[1],r[2]).length(),o=Ms.set(r[4],r[5],r[6]).length(),s=Ms.set(r[8],r[9],r[10]).length();i<0&&(a=-a),Ns.copy(this);let c=1/a,l=1/o,u=1/s;return Ns.elements[0]*=c,Ns.elements[1]*=c,Ns.elements[2]*=c,Ns.elements[4]*=l,Ns.elements[5]*=l,Ns.elements[6]*=l,Ns.elements[8]*=u,Ns.elements[9]*=u,Ns.elements[10]*=u,t.setFromRotationMatrix(Ns),n.x=a,n.y=o,n.z=s,this}makePerspective(e,t,n,r,i,a,o=So,s=!1){let c=this.elements,l=2*i/(t-e),u=2*i/(n-r),d=(t+e)/(t-e),f=(n+r)/(n-r),p,m;if(s)p=i/(a-i),m=a*i/(a-i);else if(o===2e3)p=-(a+i)/(a-i),m=-2*a*i/(a-i);else if(o===2001)p=-a/(a-i),m=-a*i/(a-i);else throw Error(`THREE.Matrix4.makePerspective(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=f,c[13]=0,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,r,i,a,o=So,s=!1){let c=this.elements,l=2/(t-e),u=2/(n-r),d=-(t+e)/(t-e),f=-(n+r)/(n-r),p,m;if(s)p=1/(a-i),m=a/(a-i);else if(o===2e3)p=-2/(a-i),m=-(a+i)/(a-i);else if(o===2001)p=-1/(a-i),m=-i/(a-i);else throw Error(`THREE.Matrix4.makeOrthographic(): Invalid coordinate system: `+o);return c[0]=l,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=f,c[2]=0,c[6]=0,c[10]=p,c[14]=m,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){let t=this.elements,n=e.elements;for(let e=0;e<16;e++)if(t[e]!==n[e])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){let n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}},Ms=new J,Ns=new js,Ps=new J(0,0,0),Fs=new J(1,1,1),Is=new J,Ls=new J,Rs=new J,zs=new js,Bs=new cs,Vs=class e{constructor(t=0,n=0,r=0,i=e.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=n,this._z=r,this._order=i}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,r=this._order){return this._x=e,this._y=t,this._z=n,this._order=r,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){let r=e.elements,i=r[0],a=r[4],o=r[8],s=r[1],c=r[5],l=r[9],u=r[2],d=r[6],f=r[10];switch(t){case`XYZ`:this._y=Math.asin(Bo(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-l,f),this._z=Math.atan2(-a,i)):(this._x=Math.atan2(d,c),this._z=0);break;case`YXZ`:this._x=Math.asin(-Bo(l,-1,1)),Math.abs(l)<.9999999?(this._y=Math.atan2(o,f),this._z=Math.atan2(s,c)):(this._y=Math.atan2(-u,i),this._z=0);break;case`ZXY`:this._x=Math.asin(Bo(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,f),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(s,i));break;case`ZYX`:this._y=Math.asin(-Bo(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,f),this._z=Math.atan2(s,i)):(this._x=0,this._z=Math.atan2(-a,c));break;case`YZX`:this._z=Math.asin(Bo(s,-1,1)),Math.abs(s)<.9999999?(this._x=Math.atan2(-l,c),this._y=Math.atan2(-u,i)):(this._x=0,this._y=Math.atan2(o,f));break;case`XZY`:this._z=Math.asin(-Bo(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,i)):(this._x=Math.atan2(-l,f),this._y=0);break;default:G(`Euler: .setFromRotationMatrix() encountered an unknown order: `+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return zs.makeRotationFromQuaternion(e),this.setFromRotationMatrix(zs,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Bs.setFromEuler(this),this.setFromQuaternion(Bs,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}};Vs.DEFAULT_ORDER=`XYZ`;var Hs=class{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!=0}},Us=0,Ws=new J,Gs=new cs,Ks=new js,qs=new J,Js=new J,Ys=new J,Xs=new cs,Zs=new J(1,0,0),Qs=new J(0,1,0),$s=new J(0,0,1),ec={type:`added`},tc={type:`removed`},nc={type:`childadded`,child:null},rc={type:`childremoved`,child:null},ic=class e extends Po{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Us++}),this.uuid=zo(),this.name=``,this.type=`Object3D`,this.parent=null,this.children=[],this.up=e.DEFAULT_UP.clone();let t=new J,n=new Vs,r=new cs,i=new J(1,1,1);function a(){r.setFromEuler(n,!1)}function o(){n.setFromQuaternion(r,void 0,!1)}n._onChange(a),r._onChange(o),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:n},quaternion:{configurable:!0,enumerable:!0,value:r},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new js},normalMatrix:{value:new Y}}),this.matrix=new js,this.matrixWorld=new js,this.matrixAutoUpdate=e.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=e.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new Hs,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Gs.setFromAxisAngle(e,t),this.quaternion.multiply(Gs),this}rotateOnWorldAxis(e,t){return Gs.setFromAxisAngle(e,t),this.quaternion.premultiply(Gs),this}rotateX(e){return this.rotateOnAxis(Zs,e)}rotateY(e){return this.rotateOnAxis(Qs,e)}rotateZ(e){return this.rotateOnAxis($s,e)}translateOnAxis(e,t){return Ws.copy(e).applyQuaternion(this.quaternion),this.position.add(Ws.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Zs,e)}translateY(e){return this.translateOnAxis(Qs,e)}translateZ(e){return this.translateOnAxis($s,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(Ks.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?qs.copy(e):qs.set(e,t,n);let r=this.parent;this.updateWorldMatrix(!0,!1),Js.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?Ks.lookAt(Js,qs,this.up):Ks.lookAt(qs,Js,this.up),this.quaternion.setFromRotationMatrix(Ks),r&&(Ks.extractRotation(r.matrixWorld),Gs.setFromRotationMatrix(Ks),this.quaternion.premultiply(Gs.invert()))}add(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return e===this?(K(`Object3D.add: object can't be added as a child of itself.`,e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(ec),nc.child=e,this.dispatchEvent(nc),nc.child=null):K(`Object3D.add: object not an instance of THREE.Object3D.`,e),this)}remove(e){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.remove(arguments[e]);return this}let t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(tc),rc.child=e,this.dispatchEvent(rc),rc.child=null),this}removeFromParent(){let e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),Ks.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),Ks.multiply(e.parent.matrixWorld)),e.applyMatrix4(Ks),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(ec),nc.child=e,this.dispatchEvent(nc),nc.child=null,this}getObjectById(e){return this.getObjectByProperty(`id`,e)}getObjectByName(e){return this.getObjectByProperty(`name`,e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,r=this.children.length;n<r;n++){let r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);let r=this.children;for(let i=0,a=r.length;i<a;i++)r[i].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Js,e,Ys),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Js,Xs,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);let t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].traverseVisible(e)}traverseAncestors(e){let t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);let e=this.pivot;if(e!==null){let t=e.x,n=e.y,r=e.z,i=this.matrix.elements;i[12]+=t-i[0]*t-i[4]*n-i[8]*r,i[13]+=n-i[1]*t-i[5]*n-i[9]*r,i[14]+=r-i[2]*t-i[6]*n-i[10]*r}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);let t=this.children;for(let n=0,r=t.length;n<r;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t){let n=this.parent;if(e===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),t===!0){let e=this.children;for(let t=0,n=e.length;t<n;t++)e[t].updateWorldMatrix(!1,!0)}}toJSON(e){let t=e===void 0||typeof e==`string`,n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:`Object`,generator:`Object3D.toJSON`});let r={};r.uuid=this.uuid,r.type=this.type,this.name!==``&&(r.name=this.name),this.castShadow===!0&&(r.castShadow=!0),this.receiveShadow===!0&&(r.receiveShadow=!0),this.visible===!1&&(r.visible=!1),this.frustumCulled===!1&&(r.frustumCulled=!1),this.renderOrder!==0&&(r.renderOrder=this.renderOrder),this.static!==!1&&(r.static=this.static),Object.keys(this.userData).length>0&&(r.userData=this.userData),r.layers=this.layers.mask,r.matrix=this.matrix.toArray(),r.up=this.up.toArray(),this.pivot!==null&&(r.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(r.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(r.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(r.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(r.type=`InstancedMesh`,r.count=this.count,r.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(r.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(r.type=`BatchedMesh`,r.perObjectFrustumCulled=this.perObjectFrustumCulled,r.sortObjects=this.sortObjects,r.drawRanges=this._drawRanges,r.reservedRanges=this._reservedRanges,r.geometryInfo=this._geometryInfo.map(e=>({...e,boundingBox:e.boundingBox?e.boundingBox.toJSON():void 0,boundingSphere:e.boundingSphere?e.boundingSphere.toJSON():void 0})),r.instanceInfo=this._instanceInfo.map(e=>({...e})),r.availableInstanceIds=this._availableInstanceIds.slice(),r.availableGeometryIds=this._availableGeometryIds.slice(),r.nextIndexStart=this._nextIndexStart,r.nextVertexStart=this._nextVertexStart,r.geometryCount=this._geometryCount,r.maxInstanceCount=this._maxInstanceCount,r.maxVertexCount=this._maxVertexCount,r.maxIndexCount=this._maxIndexCount,r.geometryInitialized=this._geometryInitialized,r.matricesTexture=this._matricesTexture.toJSON(e),r.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(r.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(r.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(r.boundingBox=this.boundingBox.toJSON()));function i(t,n){return t[n.uuid]===void 0&&(t[n.uuid]=n.toJSON(e)),n.uuid}if(this.isScene)this.background&&(this.background.isColor?r.background=this.background.toJSON():this.background.isTexture&&(r.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(r.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){r.geometry=i(e.geometries,this.geometry);let t=this.geometry.parameters;if(t!==void 0&&t.shapes!==void 0){let n=t.shapes;if(Array.isArray(n))for(let t=0,r=n.length;t<r;t++){let r=n[t];i(e.shapes,r)}else i(e.shapes,n)}}if(this.isSkinnedMesh&&(r.bindMode=this.bindMode,r.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(i(e.skeletons,this.skeleton),r.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){let t=[];for(let n=0,r=this.material.length;n<r;n++)t.push(i(e.materials,this.material[n]));r.material=t}else r.material=i(e.materials,this.material);if(this.children.length>0){r.children=[];for(let t=0;t<this.children.length;t++)r.children.push(this.children[t].toJSON(e).object)}if(this.animations.length>0){r.animations=[];for(let t=0;t<this.animations.length;t++){let n=this.animations[t];r.animations.push(i(e.animations,n))}}if(t){let t=a(e.geometries),r=a(e.materials),i=a(e.textures),o=a(e.images),s=a(e.shapes),c=a(e.skeletons),l=a(e.animations),u=a(e.nodes);t.length>0&&(n.geometries=t),r.length>0&&(n.materials=r),i.length>0&&(n.textures=i),o.length>0&&(n.images=o),s.length>0&&(n.shapes=s),c.length>0&&(n.skeletons=c),l.length>0&&(n.animations=l),u.length>0&&(n.nodes=u)}return n.object=r,n;function a(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot===null?null:e.pivot.clone(),this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let t=0;t<e.children.length;t++){let n=e.children[t];this.add(n.clone())}return this}};ic.DEFAULT_UP=new J(0,1,0),ic.DEFAULT_MATRIX_AUTO_UPDATE=!0,ic.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var ac=class extends ic{constructor(){super(),this.isGroup=!0,this.type=`Group`}},oc={type:`move`},sc=class{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new ac,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new ac,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new J,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new J),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new ac,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new J,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new J,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){let t=this._hand;if(t)for(let n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:`connected`,data:e}),this}disconnect(e){return this.dispatchEvent({type:`disconnected`,data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let r=null,i=null,a=null,o=this._targetRay,s=this._grip,c=this._hand;if(e&&t.session.visibilityState!==`visible-blurred`){if(c&&e.hand){a=!0;for(let r of e.hand.values()){let e=t.getJointPose(r,n),i=this._getHandJoint(c,r);e!==null&&(i.matrix.fromArray(e.transform.matrix),i.matrix.decompose(i.position,i.rotation,i.scale),i.matrixWorldNeedsUpdate=!0,i.jointRadius=e.radius),i.visible=e!==null}let r=c.joints[`index-finger-tip`],i=c.joints[`thumb-tip`],o=r.position.distanceTo(i.position);c.inputState.pinching&&o>.025?(c.inputState.pinching=!1,this.dispatchEvent({type:`pinchend`,handedness:e.handedness,target:this})):!c.inputState.pinching&&o<=.015&&(c.inputState.pinching=!0,this.dispatchEvent({type:`pinchstart`,handedness:e.handedness,target:this}))}else s!==null&&e.gripSpace&&(i=t.getPose(e.gripSpace,n),i!==null&&(s.matrix.fromArray(i.transform.matrix),s.matrix.decompose(s.position,s.rotation,s.scale),s.matrixWorldNeedsUpdate=!0,i.linearVelocity?(s.hasLinearVelocity=!0,s.linearVelocity.copy(i.linearVelocity)):s.hasLinearVelocity=!1,i.angularVelocity?(s.hasAngularVelocity=!0,s.angularVelocity.copy(i.angularVelocity)):s.hasAngularVelocity=!1,s.eventsEnabled&&s.dispatchEvent({type:`gripUpdated`,data:e,target:this})));o!==null&&(r=t.getPose(e.targetRaySpace,n),r===null&&i!==null&&(r=i),r!==null&&(o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,r.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(r.linearVelocity)):o.hasLinearVelocity=!1,r.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(r.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(oc)))}return o!==null&&(o.visible=r!==null),s!==null&&(s.visible=i!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){let n=new ac;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}},cc={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},lc={h:0,s:0,l:0},uc={h:0,s:0,l:0};function dc(e,t,n){return n<0&&(n+=1),n>1&&--n,n<1/6?e+(t-e)*6*n:n<1/2?t:n<2/3?e+(t-e)*6*(2/3-n):e}var X=class{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){let t=e;t&&t.isColor?this.copy(t):typeof t==`number`?this.setHex(t):typeof t==`string`&&this.setStyle(t)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=go){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,hs.colorSpaceToWorking(this,t),this}setRGB(e,t,n,r=hs.workingColorSpace){return this.r=e,this.g=t,this.b=n,hs.colorSpaceToWorking(this,r),this}setHSL(e,t,n,r=hs.workingColorSpace){if(e=Vo(e,1),t=Bo(t,0,1),n=Bo(n,0,1),t===0)this.r=this.g=this.b=n;else{let r=n<=.5?n*(1+t):n+t-n*t,i=2*n-r;this.r=dc(i,r,e+1/3),this.g=dc(i,r,e),this.b=dc(i,r,e-1/3)}return hs.colorSpaceToWorking(this,r),this}setStyle(e,t=go){function n(t){t!==void 0&&parseFloat(t)<1&&G(`Color: Alpha component of `+e+` will be ignored.`)}let r;if(r=/^(\w+)\(([^\)]*)\)/.exec(e)){let i,a=r[1],o=r[2];switch(a){case`rgb`:case`rgba`:if(i=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(255,parseInt(i[1],10))/255,Math.min(255,parseInt(i[2],10))/255,Math.min(255,parseInt(i[3],10))/255,t);if(i=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setRGB(Math.min(100,parseInt(i[1],10))/100,Math.min(100,parseInt(i[2],10))/100,Math.min(100,parseInt(i[3],10))/100,t);break;case`hsl`:case`hsla`:if(i=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(i[4]),this.setHSL(parseFloat(i[1])/360,parseFloat(i[2])/100,parseFloat(i[3])/100,t);break;default:G(`Color: Unknown color model `+e)}}else if(r=/^\#([A-Fa-f\d]+)$/.exec(e)){let n=r[1],i=n.length;if(i===3)return this.setRGB(parseInt(n.charAt(0),16)/15,parseInt(n.charAt(1),16)/15,parseInt(n.charAt(2),16)/15,t);if(i===6)return this.setHex(parseInt(n,16),t);G(`Color: Invalid hex color `+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=go){let n=cc[e.toLowerCase()];return n===void 0?G(`Color: Unknown color `+e):this.setHex(n,t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=gs(e.r),this.g=gs(e.g),this.b=gs(e.b),this}copyLinearToSRGB(e){return this.r=_s(e.r),this.g=_s(e.g),this.b=_s(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=go){return hs.workingToColorSpace(fc.copy(this),e),Math.round(Bo(fc.r*255,0,255))*65536+Math.round(Bo(fc.g*255,0,255))*256+Math.round(Bo(fc.b*255,0,255))}getHexString(e=go){return(`000000`+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=hs.workingColorSpace){hs.workingToColorSpace(fc.copy(this),t);let n=fc.r,r=fc.g,i=fc.b,a=Math.max(n,r,i),o=Math.min(n,r,i),s,c,l=(o+a)/2;if(o===a)s=0,c=0;else{let e=a-o;switch(c=l<=.5?e/(a+o):e/(2-a-o),a){case n:s=(r-i)/e+(r<i?6:0);break;case r:s=(i-n)/e+2;break;case i:s=(n-r)/e+4;break}s/=6}return e.h=s,e.s=c,e.l=l,e}getRGB(e,t=hs.workingColorSpace){return hs.workingToColorSpace(fc.copy(this),t),e.r=fc.r,e.g=fc.g,e.b=fc.b,e}getStyle(e=go){hs.workingToColorSpace(fc.copy(this),e);let t=fc.r,n=fc.g,r=fc.b;return e===`srgb`?`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(r*255)})`:`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${r.toFixed(3)})`}offsetHSL(e,t,n){return this.getHSL(lc),this.setHSL(lc.h+e,lc.s+t,lc.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(lc),e.getHSL(uc);let n=Wo(lc.h,uc.h,t),r=Wo(lc.s,uc.s,t),i=Wo(lc.l,uc.l,t);return this.setHSL(n,r,i),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){let t=this.r,n=this.g,r=this.b,i=e.elements;return this.r=i[0]*t+i[3]*n+i[6]*r,this.g=i[1]*t+i[4]*n+i[7]*r,this.b=i[2]*t+i[5]*n+i[8]*r,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}},fc=new X;X.NAMES=cc;var pc=class extends ic{constructor(){super(),this.isScene=!0,this.type=`Scene`,this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new Vs,this.environmentIntensity=1,this.environmentRotation=new Vs,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){let t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}},mc=new J,hc=new J,gc=new J,_c=new J,vc=new J,yc=new J,bc=new J,xc=new J,Sc=new J,Cc=new J,wc=new Es,Tc=new Es,Ec=new Es,Dc=class e{constructor(e=new J,t=new J,n=new J){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,r){r.subVectors(n,t),mc.subVectors(e,t),r.cross(mc);let i=r.lengthSq();return i>0?r.multiplyScalar(1/Math.sqrt(i)):r.set(0,0,0)}static getBarycoord(e,t,n,r,i){mc.subVectors(r,t),hc.subVectors(n,t),gc.subVectors(e,t);let a=mc.dot(mc),o=mc.dot(hc),s=mc.dot(gc),c=hc.dot(hc),l=hc.dot(gc),u=a*c-o*o;if(u===0)return i.set(0,0,0),null;let d=1/u,f=(c*s-o*l)*d,p=(a*l-o*s)*d;return i.set(1-f-p,p,f)}static containsPoint(e,t,n,r){return this.getBarycoord(e,t,n,r,_c)===null?!1:_c.x>=0&&_c.y>=0&&_c.x+_c.y<=1}static getInterpolation(e,t,n,r,i,a,o,s){return this.getBarycoord(e,t,n,r,_c)===null?(s.x=0,s.y=0,`z`in s&&(s.z=0),`w`in s&&(s.w=0),null):(s.setScalar(0),s.addScaledVector(i,_c.x),s.addScaledVector(a,_c.y),s.addScaledVector(o,_c.z),s)}static getInterpolatedAttribute(e,t,n,r,i,a){return wc.setScalar(0),Tc.setScalar(0),Ec.setScalar(0),wc.fromBufferAttribute(e,t),Tc.fromBufferAttribute(e,n),Ec.fromBufferAttribute(e,r),a.setScalar(0),a.addScaledVector(wc,i.x),a.addScaledVector(Tc,i.y),a.addScaledVector(Ec,i.z),a}static isFrontFacing(e,t,n,r){return mc.subVectors(n,t),hc.subVectors(e,t),mc.cross(hc).dot(r)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,r){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[r]),this}setFromAttributeAndIndices(e,t,n,r){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,r),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return mc.subVectors(this.c,this.b),hc.subVectors(this.a,this.b),mc.cross(hc).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return e.getNormal(this.a,this.b,this.c,t)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,n){return e.getBarycoord(t,this.a,this.b,this.c,n)}getInterpolation(t,n,r,i,a){return e.getInterpolation(t,this.a,this.b,this.c,n,r,i,a)}containsPoint(t){return e.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return e.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){let n=this.a,r=this.b,i=this.c,a,o;vc.subVectors(r,n),yc.subVectors(i,n),xc.subVectors(e,n);let s=vc.dot(xc),c=yc.dot(xc);if(s<=0&&c<=0)return t.copy(n);Sc.subVectors(e,r);let l=vc.dot(Sc),u=yc.dot(Sc);if(l>=0&&u<=l)return t.copy(r);let d=s*u-l*c;if(d<=0&&s>=0&&l<=0)return a=s/(s-l),t.copy(n).addScaledVector(vc,a);Cc.subVectors(e,i);let f=vc.dot(Cc),p=yc.dot(Cc);if(p>=0&&f<=p)return t.copy(i);let m=f*c-s*p;if(m<=0&&c>=0&&p<=0)return o=c/(c-p),t.copy(n).addScaledVector(yc,o);let h=l*p-f*u;if(h<=0&&u-l>=0&&f-p>=0)return bc.subVectors(i,r),o=(u-l)/(u-l+(f-p)),t.copy(r).addScaledVector(bc,o);let g=1/(h+m+d);return a=m*g,o=d*g,t.copy(n).addScaledVector(vc,a).addScaledVector(yc,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}},Oc=class{constructor(e=new J(1/0,1/0,1/0),t=new J(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(Ac.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(Ac.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){let n=Ac.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);let n=e.geometry;if(n!==void 0){let r=n.getAttribute(`position`);if(t===!0&&r!==void 0&&e.isInstancedMesh!==!0)for(let t=0,n=r.count;t<n;t++)e.isMesh===!0?e.getVertexPosition(t,Ac):Ac.fromBufferAttribute(r,t),Ac.applyMatrix4(e.matrixWorld),this.expandByPoint(Ac);else e.boundingBox===void 0?(n.boundingBox===null&&n.computeBoundingBox(),jc.copy(n.boundingBox)):(e.boundingBox===null&&e.computeBoundingBox(),jc.copy(e.boundingBox)),jc.applyMatrix4(e.matrixWorld),this.union(jc)}let r=e.children;for(let e=0,n=r.length;e<n;e++)this.expandByObject(r[e],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,Ac),Ac.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(Rc),zc.subVectors(this.max,Rc),Mc.subVectors(e.a,Rc),Nc.subVectors(e.b,Rc),Pc.subVectors(e.c,Rc),Fc.subVectors(Nc,Mc),Ic.subVectors(Pc,Nc),Lc.subVectors(Mc,Pc);let t=[0,-Fc.z,Fc.y,0,-Ic.z,Ic.y,0,-Lc.z,Lc.y,Fc.z,0,-Fc.x,Ic.z,0,-Ic.x,Lc.z,0,-Lc.x,-Fc.y,Fc.x,0,-Ic.y,Ic.x,0,-Lc.y,Lc.x,0];return!Hc(t,Mc,Nc,Pc,zc)||(t=[1,0,0,0,1,0,0,0,1],!Hc(t,Mc,Nc,Pc,zc))?!1:(Bc.crossVectors(Fc,Ic),t=[Bc.x,Bc.y,Bc.z],Hc(t,Mc,Nc,Pc,zc))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,Ac).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(Ac).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(kc[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),kc[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),kc[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),kc[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),kc[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),kc[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),kc[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),kc[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(kc),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}},kc=[new J,new J,new J,new J,new J,new J,new J,new J],Ac=new J,jc=new Oc,Mc=new J,Nc=new J,Pc=new J,Fc=new J,Ic=new J,Lc=new J,Rc=new J,zc=new J,Bc=new J,Vc=new J;function Hc(e,t,n,r,i){for(let a=0,o=e.length-3;a<=o;a+=3){Vc.fromArray(e,a);let o=i.x*Math.abs(Vc.x)+i.y*Math.abs(Vc.y)+i.z*Math.abs(Vc.z),s=t.dot(Vc),c=n.dot(Vc),l=r.dot(Vc);if(Math.max(-Math.max(s,c,l),Math.min(s,c,l))>o)return!1}return!0}var Uc=new J,Wc=new q,Gc=0,Kc=class extends Po{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw TypeError(`THREE.BufferAttribute: array should be a Typed Array.`);this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Gc++}),this.name=``,this.array=e,this.itemSize=t,this.count=e===void 0?0:e.length/t,this.normalized=n,this.usage=xo,this.updateRanges=[],this.gpuType=ca,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let r=0,i=this.itemSize;r<i;r++)this.array[e+r]=t.array[n+r];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Wc.fromBufferAttribute(this,t),Wc.applyMatrix3(e),this.setXY(t,Wc.x,Wc.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)Uc.fromBufferAttribute(this,t),Uc.applyMatrix3(e),this.setXYZ(t,Uc.x,Uc.y,Uc.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)Uc.fromBufferAttribute(this,t),Uc.applyMatrix4(e),this.setXYZ(t,Uc.x,Uc.y,Uc.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)Uc.fromBufferAttribute(this,t),Uc.applyNormalMatrix(e),this.setXYZ(t,Uc.x,Uc.y,Uc.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)Uc.fromBufferAttribute(this,t),Uc.transformDirection(e),this.setXYZ(t,Uc.x,Uc.y,Uc.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=as(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=os(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=as(t,this.array)),t}setX(e,t){return this.normalized&&(t=os(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=as(t,this.array)),t}setY(e,t){return this.normalized&&(t=os(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=as(t,this.array)),t}setZ(e,t){return this.normalized&&(t=os(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=as(t,this.array)),t}setW(e,t){return this.normalized&&(t=os(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=os(t,this.array),n=os(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,r){return e*=this.itemSize,this.normalized&&(t=os(t,this.array),n=os(n,this.array),r=os(r,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this}setXYZW(e,t,n,r,i){return e*=this.itemSize,this.normalized&&(t=os(t,this.array),n=os(n,this.array),r=os(r,this.array),i=os(i,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=r,this.array[e+3]=i,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==``&&(e.name=this.name),this.usage!==35044&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:`dispose`})}},qc=class extends Kc{constructor(e,t,n){super(new Uint16Array(e),t,n)}},Jc=class extends Kc{constructor(e,t,n){super(new Uint32Array(e),t,n)}},Yc=class extends Kc{constructor(e,t,n){super(new Float32Array(e),t,n)}},Xc=new Oc,Zc=new J,Qc=new J,$c=class{constructor(e=new J,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){let n=this.center;t===void 0?Xc.setFromPoints(e).getCenter(n):n.copy(t);let r=0;for(let t=0,i=e.length;t<i;t++)r=Math.max(r,n.distanceToSquared(e[t]));return this.radius=Math.sqrt(r),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){let t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){let n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius*=e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;Zc.subVectors(e,this.center);let t=Zc.lengthSq();if(t>this.radius*this.radius){let e=Math.sqrt(t),n=(e-this.radius)*.5;this.center.addScaledVector(Zc,n/e),this.radius+=n}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Qc.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(Zc.copy(e.center).add(Qc)),this.expandByPoint(Zc.copy(e.center).sub(Qc))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}},el=0,tl=new js,nl=new ic,rl=new J,il=new Oc,al=new Oc,ol=new J,sl=class e extends Po{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:el++}),this.uuid=zo(),this.name=``,this.type=`BufferGeometry`,this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Co(e)?Jc:qc)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){let t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);let n=this.attributes.normal;if(n!==void 0){let t=new Y().getNormalMatrix(e);n.applyNormalMatrix(t),n.needsUpdate=!0}let r=this.attributes.tangent;return r!==void 0&&(r.transformDirection(e),r.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(e){return tl.makeRotationFromQuaternion(e),this.applyMatrix4(tl),this}rotateX(e){return tl.makeRotationX(e),this.applyMatrix4(tl),this}rotateY(e){return tl.makeRotationY(e),this.applyMatrix4(tl),this}rotateZ(e){return tl.makeRotationZ(e),this.applyMatrix4(tl),this}translate(e,t,n){return tl.makeTranslation(e,t,n),this.applyMatrix4(tl),this}scale(e,t,n){return tl.makeScale(e,t,n),this.applyMatrix4(tl),this}lookAt(e){return nl.lookAt(e),nl.updateMatrix(),this.applyMatrix4(nl.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(rl).negate(),this.translate(rl.x,rl.y,rl.z),this}setFromPoints(e){let t=this.getAttribute(`position`);if(t===void 0){let t=[];for(let n=0,r=e.length;n<r;n++){let r=e[n];t.push(r.x,r.y,r.z||0)}this.setAttribute(`position`,new Yc(t,3))}else{let n=Math.min(e.length,t.count);for(let r=0;r<n;r++){let n=e[r];t.setXYZ(r,n.x,n.y,n.z||0)}e.length>t.count&&G(`BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.`),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new Oc);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){K(`BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.`,this),this.boundingBox.set(new J(-1/0,-1/0,-1/0),new J(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];il.setFromBufferAttribute(n),this.morphTargetsRelative?(ol.addVectors(this.boundingBox.min,il.min),this.boundingBox.expandByPoint(ol),ol.addVectors(this.boundingBox.max,il.max),this.boundingBox.expandByPoint(ol)):(this.boundingBox.expandByPoint(il.min),this.boundingBox.expandByPoint(il.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&K(`BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.`,this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new $c);let e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){K(`BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.`,this),this.boundingSphere.set(new J,1/0);return}if(e){let n=this.boundingSphere.center;if(il.setFromBufferAttribute(e),t)for(let e=0,n=t.length;e<n;e++){let n=t[e];al.setFromBufferAttribute(n),this.morphTargetsRelative?(ol.addVectors(il.min,al.min),il.expandByPoint(ol),ol.addVectors(il.max,al.max),il.expandByPoint(ol)):(il.expandByPoint(al.min),il.expandByPoint(al.max))}il.getCenter(n);let r=0;for(let t=0,i=e.count;t<i;t++)ol.fromBufferAttribute(e,t),r=Math.max(r,n.distanceToSquared(ol));if(t)for(let i=0,a=t.length;i<a;i++){let a=t[i],o=this.morphTargetsRelative;for(let t=0,i=a.count;t<i;t++)ol.fromBufferAttribute(a,t),o&&(rl.fromBufferAttribute(e,t),ol.add(rl)),r=Math.max(r,n.distanceToSquared(ol))}this.boundingSphere.radius=Math.sqrt(r),isNaN(this.boundingSphere.radius)&&K(`BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.`,this)}}computeTangents(){let e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){K(`BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)`);return}let n=t.position,r=t.normal,i=t.uv;this.hasAttribute(`tangent`)===!1&&this.setAttribute(`tangent`,new Kc(new Float32Array(4*n.count),4));let a=this.getAttribute(`tangent`),o=[],s=[];for(let e=0;e<n.count;e++)o[e]=new J,s[e]=new J;let c=new J,l=new J,u=new J,d=new q,f=new q,p=new q,m=new J,h=new J;function g(e,t,r){c.fromBufferAttribute(n,e),l.fromBufferAttribute(n,t),u.fromBufferAttribute(n,r),d.fromBufferAttribute(i,e),f.fromBufferAttribute(i,t),p.fromBufferAttribute(i,r),l.sub(c),u.sub(c),f.sub(d),p.sub(d);let a=1/(f.x*p.y-p.x*f.y);isFinite(a)&&(m.copy(l).multiplyScalar(p.y).addScaledVector(u,-f.y).multiplyScalar(a),h.copy(u).multiplyScalar(f.x).addScaledVector(l,-p.x).multiplyScalar(a),o[e].add(m),o[t].add(m),o[r].add(m),s[e].add(h),s[t].add(h),s[r].add(h))}let _=this.groups;_.length===0&&(_=[{start:0,count:e.count}]);for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)g(e.getX(t+0),e.getX(t+1),e.getX(t+2))}let v=new J,y=new J,b=new J,x=new J;function S(e){b.fromBufferAttribute(r,e),x.copy(b);let t=o[e];v.copy(t),v.sub(b.multiplyScalar(b.dot(t))).normalize(),y.crossVectors(x,t);let n=y.dot(s[e])<0?-1:1;a.setXYZW(e,v.x,v.y,v.z,n)}for(let t=0,n=_.length;t<n;++t){let n=_[t],r=n.start,i=n.count;for(let t=r,n=r+i;t<n;t+=3)S(e.getX(t+0)),S(e.getX(t+1)),S(e.getX(t+2))}}computeVertexNormals(){let e=this.index,t=this.getAttribute(`position`);if(t!==void 0){let n=this.getAttribute(`normal`);if(n===void 0)n=new Kc(new Float32Array(t.count*3),3),this.setAttribute(`normal`,n);else for(let e=0,t=n.count;e<t;e++)n.setXYZ(e,0,0,0);let r=new J,i=new J,a=new J,o=new J,s=new J,c=new J,l=new J,u=new J;if(e)for(let d=0,f=e.count;d<f;d+=3){let f=e.getX(d+0),p=e.getX(d+1),m=e.getX(d+2);r.fromBufferAttribute(t,f),i.fromBufferAttribute(t,p),a.fromBufferAttribute(t,m),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),o.fromBufferAttribute(n,f),s.fromBufferAttribute(n,p),c.fromBufferAttribute(n,m),o.add(l),s.add(l),c.add(l),n.setXYZ(f,o.x,o.y,o.z),n.setXYZ(p,s.x,s.y,s.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let e=0,o=t.count;e<o;e+=3)r.fromBufferAttribute(t,e+0),i.fromBufferAttribute(t,e+1),a.fromBufferAttribute(t,e+2),l.subVectors(a,i),u.subVectors(r,i),l.cross(u),n.setXYZ(e+0,l.x,l.y,l.z),n.setXYZ(e+1,l.x,l.y,l.z),n.setXYZ(e+2,l.x,l.y,l.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){let e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)ol.fromBufferAttribute(e,t),ol.normalize(),e.setXYZ(t,ol.x,ol.y,ol.z)}toNonIndexed(){function t(e,t){let n=e.array,r=e.itemSize,i=e.normalized,a=new n.constructor(t.length*r),o=0,s=0;for(let i=0,c=t.length;i<c;i++){o=e.isInterleavedBufferAttribute?t[i]*e.data.stride+e.offset:t[i]*r;for(let e=0;e<r;e++)a[s++]=n[o++]}return new Kc(a,r,i)}if(this.index===null)return G(`BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.`),this;let n=new e,r=this.index.array,i=this.attributes;for(let e in i){let a=i[e],o=t(a,r);n.setAttribute(e,o)}let a=this.morphAttributes;for(let e in a){let i=[],o=a[e];for(let e=0,n=o.length;e<n;e++){let n=o[e],a=t(n,r);i.push(a)}n.morphAttributes[e]=i}n.morphTargetsRelative=this.morphTargetsRelative;let o=this.groups;for(let e=0,t=o.length;e<t;e++){let t=o[e];n.addGroup(t.start,t.count,t.materialIndex)}return n}toJSON(){let e={metadata:{version:4.7,type:`BufferGeometry`,generator:`BufferGeometry.toJSON`}};if(e.uuid=this.uuid,e.type=this.type,this.name!==``&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0){let t=this.parameters;for(let n in t)t[n]!==void 0&&(e[n]=t[n]);return e}e.data={attributes:{}};let t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});let n=this.attributes;for(let t in n){let r=n[t];e.data.attributes[t]=r.toJSON(e.data)}let r={},i=!1;for(let t in this.morphAttributes){let n=this.morphAttributes[t],a=[];for(let t=0,r=n.length;t<r;t++){let r=n[t];a.push(r.toJSON(e.data))}a.length>0&&(r[t]=a,i=!0)}i&&(e.data.morphAttributes=r,e.data.morphTargetsRelative=this.morphTargetsRelative);let a=this.groups;a.length>0&&(e.data.groups=JSON.parse(JSON.stringify(a)));let o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let t={};this.name=e.name;let n=e.index;n!==null&&this.setIndex(n.clone());let r=e.attributes;for(let e in r){let n=r[e];this.setAttribute(e,n.clone(t))}let i=e.morphAttributes;for(let e in i){let n=[],r=i[e];for(let e=0,i=r.length;e<i;e++)n.push(r[e].clone(t));this.morphAttributes[e]=n}this.morphTargetsRelative=e.morphTargetsRelative;let a=e.groups;for(let e=0,t=a.length;e<t;e++){let t=a[e];this.addGroup(t.start,t.count,t.materialIndex)}let o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());let s=e.boundingSphere;return s!==null&&(this.boundingSphere=s.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this}dispose(){this.dispatchEvent({type:`dispose`})}},cl=0,ll=class extends Po{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:cl++}),this.uuid=zo(),this.name=``,this.type=`Material`,this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new X(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=bo,this.stencilZFail=bo,this.stencilZPass=bo,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(let t in e){let n=e[t];if(n===void 0){G(`Material: parameter '${t}' has value of undefined.`);continue}let r=this[t];if(r===void 0){G(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}r&&r.isColor?r.set(n):r&&r.isVector3&&n&&n.isVector3?r.copy(n):this[t]=n}}toJSON(e){let t=e===void 0||typeof e==`string`;t&&(e={textures:{},images:{}});let n={metadata:{version:4.7,type:`Material`,generator:`Material.toJSON`}};n.uuid=this.uuid,n.type=this.type,this.name!==``&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==1&&(n.blending=this.blending),this.side!==0&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==204&&(n.blendSrc=this.blendSrc),this.blendDst!==205&&(n.blendDst=this.blendDst),this.blendEquation!==100&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==3&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==519&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==7680&&(n.stencilFail=this.stencilFail),this.stencilZFail!==7680&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==7680&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!==`round`&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!==`round`&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function r(e){let t=[];for(let n in e){let r=e[n];delete r.metadata,t.push(r)}return t}if(t){let t=r(e.textures),i=r(e.images);t.length>0&&(n.textures=t),i.length>0&&(n.images=i)}return n}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;let t=e.clippingPlanes,n=null;if(t!==null){let e=t.length;n=Array(e);for(let r=0;r!==e;++r)n[r]=t[r].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:`dispose`})}set needsUpdate(e){e===!0&&this.version++}},ul=new J,dl=new J,fl=new J,pl=new J,ml=new J,hl=new J,gl=new J,_l=class{constructor(e=new J,t=new J(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,ul)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);let n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){let t=ul.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(ul.copy(this.origin).addScaledVector(this.direction,t),ul.distanceToSquared(e))}distanceSqToSegment(e,t,n,r){dl.copy(e).add(t).multiplyScalar(.5),fl.copy(t).sub(e).normalize(),pl.copy(this.origin).sub(dl);let i=e.distanceTo(t)*.5,a=-this.direction.dot(fl),o=pl.dot(this.direction),s=-pl.dot(fl),c=pl.lengthSq(),l=Math.abs(1-a*a),u,d,f,p;if(l>0)if(u=a*s-o,d=a*o-s,p=i*l,u>=0)if(d>=-p)if(d<=p){let e=1/l;u*=e,d*=e,f=u*(u+a*d+2*o)+d*(a*u+d+2*s)+c}else d=i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;else d=-i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;else d<=-p?(u=Math.max(0,-(-a*i+o)),d=u>0?-i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c):d<=p?(u=0,d=Math.min(Math.max(-i,-s),i),f=d*(d+2*s)+c):(u=Math.max(0,-(a*i+o)),d=u>0?i:Math.min(Math.max(-i,-s),i),f=-u*u+d*(d+2*s)+c);else d=a>0?-i:i,u=Math.max(0,-(a*d+o)),f=-u*u+d*(d+2*s)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),r&&r.copy(dl).addScaledVector(fl,d),f}intersectSphere(e,t){ul.subVectors(e.center,this.origin);let n=ul.dot(this.direction),r=ul.dot(ul)-n*n,i=e.radius*e.radius;if(r>i)return null;let a=Math.sqrt(i-r),o=n-a,s=n+a;return s<0?null:o<0?this.at(s,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){let t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;let n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){let n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){let t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,r,i,a,o,s,c=1/this.direction.x,l=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,r=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,r=(e.min.x-d.x)*c),l>=0?(i=(e.min.y-d.y)*l,a=(e.max.y-d.y)*l):(i=(e.max.y-d.y)*l,a=(e.min.y-d.y)*l),n>a||i>r||((i>n||isNaN(n))&&(n=i),(a<r||isNaN(r))&&(r=a),u>=0?(o=(e.min.z-d.z)*u,s=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,s=(e.min.z-d.z)*u),n>s||o>r)||((o>n||n!==n)&&(n=o),(s<r||r!==r)&&(r=s),r<0)?null:this.at(n>=0?n:r,t)}intersectsBox(e){return this.intersectBox(e,ul)!==null}intersectTriangle(e,t,n,r,i){ml.subVectors(t,e),hl.subVectors(n,e),gl.crossVectors(ml,hl);let a=this.direction.dot(gl),o;if(a>0){if(r)return null;o=1}else if(a<0)o=-1,a=-a;else return null;pl.subVectors(this.origin,e);let s=o*this.direction.dot(hl.crossVectors(pl,hl));if(s<0)return null;let c=o*this.direction.dot(ml.cross(pl));if(c<0||s+c>a)return null;let l=-o*pl.dot(gl);return l<0?null:this.at(l/a,i)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}},vl=class extends ll{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type=`MeshBasicMaterial`,this.color=new X(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Vs,this.combine=0,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}},yl=new js,bl=new _l,xl=new $c,Sl=new J,Cl=new J,wl=new J,Tl=new J,El=new J,Dl=new J,Ol=new J,kl=new J,Al=class extends ic{constructor(e=new sl,t=new vl){super(),this.isMesh=!0,this.type=`Mesh`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}getVertexPosition(e,t){let n=this.geometry,r=n.attributes.position,i=n.morphAttributes.position,a=n.morphTargetsRelative;t.fromBufferAttribute(r,e);let o=this.morphTargetInfluences;if(i&&o){Dl.set(0,0,0);for(let n=0,r=i.length;n<r;n++){let r=o[n],s=i[n];r!==0&&(El.fromBufferAttribute(s,e),a?Dl.addScaledVector(El,r):Dl.addScaledVector(El.sub(t),r))}t.add(Dl)}return t}raycast(e,t){let n=this.geometry,r=this.material,i=this.matrixWorld;r!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),xl.copy(n.boundingSphere),xl.applyMatrix4(i),bl.copy(e.ray).recast(e.near),!(xl.containsPoint(bl.origin)===!1&&(bl.intersectSphere(xl,Sl)===null||bl.origin.distanceToSquared(Sl)>(e.far-e.near)**2))&&(yl.copy(i).invert(),bl.copy(e.ray).applyMatrix4(yl),!(n.boundingBox!==null&&bl.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,bl)))}_computeIntersections(e,t,n){let r,i=this.geometry,a=this.material,o=i.index,s=i.attributes.position,c=i.attributes.uv,l=i.attributes.uv1,u=i.attributes.normal,d=i.groups,f=i.drawRange;if(o!==null)if(Array.isArray(a))for(let i=0,s=d.length;i<s;i++){let s=d[i],p=a[s.materialIndex],m=Math.max(s.start,f.start),h=Math.min(o.count,Math.min(s.start+s.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=o.getX(i),d=o.getX(i+1),f=o.getX(i+2);r=Ml(this,p,e,n,c,l,u,a,d,f),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=s.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),s=Math.min(o.count,f.start+f.count);for(let d=i,f=s;d<f;d+=3){let i=o.getX(d),s=o.getX(d+1),f=o.getX(d+2);r=Ml(this,a,e,n,c,l,u,i,s,f),r&&(r.faceIndex=Math.floor(d/3),t.push(r))}}else if(s!==void 0)if(Array.isArray(a))for(let i=0,o=d.length;i<o;i++){let o=d[i],p=a[o.materialIndex],m=Math.max(o.start,f.start),h=Math.min(s.count,Math.min(o.start+o.count,f.start+f.count));for(let i=m,a=h;i<a;i+=3){let a=i,s=i+1,d=i+2;r=Ml(this,p,e,n,c,l,u,a,s,d),r&&(r.faceIndex=Math.floor(i/3),r.face.materialIndex=o.materialIndex,t.push(r))}}else{let i=Math.max(0,f.start),o=Math.min(s.count,f.start+f.count);for(let s=i,d=o;s<d;s+=3){let i=s,o=s+1,d=s+2;r=Ml(this,a,e,n,c,l,u,i,o,d),r&&(r.faceIndex=Math.floor(s/3),t.push(r))}}}};function jl(e,t,n,r,i,a,o,s){let c;if(c=t.side===1?r.intersectTriangle(o,a,i,!0,s):r.intersectTriangle(i,a,o,t.side===0,s),c===null)return null;kl.copy(s),kl.applyMatrix4(e.matrixWorld);let l=n.ray.origin.distanceTo(kl);return l<n.near||l>n.far?null:{distance:l,point:kl.clone(),object:e}}function Ml(e,t,n,r,i,a,o,s,c,l){e.getVertexPosition(s,Cl),e.getVertexPosition(c,wl),e.getVertexPosition(l,Tl);let u=jl(e,t,n,r,Cl,wl,Tl,Ol);if(u){let e=new J;Dc.getBarycoord(Ol,Cl,wl,Tl,e),i&&(u.uv=Dc.getInterpolatedAttribute(i,s,c,l,e,new q)),a&&(u.uv1=Dc.getInterpolatedAttribute(a,s,c,l,e,new q)),o&&(u.normal=Dc.getInterpolatedAttribute(o,s,c,l,e,new J),u.normal.dot(r.direction)>0&&u.normal.multiplyScalar(-1));let t={a:s,b:c,c:l,normal:new J,materialIndex:0};Dc.getNormal(Cl,wl,Tl,t.normal),u.face=t,u.barycoord=e}return u}var Nl=class extends Ts{constructor(e=null,t=1,n=1,r,i,a,o,s,c=Xi,l=Xi,u,d){super(null,a,o,s,c,l,r,i,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}},Pl=class extends Kc{constructor(e,t,n,r=1){super(e,t,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=r}copy(e){return super.copy(e),this.meshPerAttribute=e.meshPerAttribute,this}toJSON(){let e=super.toJSON();return e.meshPerAttribute=this.meshPerAttribute,e.isInstancedBufferAttribute=!0,e}},Fl=new js,Il=new js,Ll=[],Rl=new Oc,zl=new js,Bl=new Al,Vl=new $c,Hl=class extends Al{constructor(e,t,n){super(e,t),this.isInstancedMesh=!0,this.instanceMatrix=new Pl(new Float32Array(n*16),16),this.previousInstanceMatrix=null,this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let e=0;e<n;e++)this.setMatrixAt(e,zl)}computeBoundingBox(){let e=this.geometry,t=this.count;this.boundingBox===null&&(this.boundingBox=new Oc),e.boundingBox===null&&e.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Fl),Rl.copy(e.boundingBox).applyMatrix4(Fl),this.boundingBox.union(Rl)}computeBoundingSphere(){let e=this.geometry,t=this.count;this.boundingSphere===null&&(this.boundingSphere=new $c),e.boundingSphere===null&&e.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<t;n++)this.getMatrixAt(n,Fl),Vl.copy(e.boundingSphere).applyMatrix4(Fl),this.boundingSphere.union(Vl)}copy(e,t){return super.copy(e,t),this.instanceMatrix.copy(e.instanceMatrix),e.previousInstanceMatrix!==null&&(this.previousInstanceMatrix=e.previousInstanceMatrix.clone()),e.morphTexture!==null&&(this.morphTexture=e.morphTexture.clone()),e.instanceColor!==null&&(this.instanceColor=e.instanceColor.clone()),this.count=e.count,e.boundingBox!==null&&(this.boundingBox=e.boundingBox.clone()),e.boundingSphere!==null&&(this.boundingSphere=e.boundingSphere.clone()),this}getColorAt(e,t){return this.instanceColor===null?t.setRGB(1,1,1):t.fromArray(this.instanceColor.array,e*3)}getMatrixAt(e,t){return t.fromArray(this.instanceMatrix.array,e*16)}getMorphAt(e,t){let n=t.morphTargetInfluences,r=this.morphTexture.source.data.data,i=e*(n.length+1)+1;for(let e=0;e<n.length;e++)n[e]=r[i+e]}raycast(e,t){let n=this.matrixWorld,r=this.count;if(Bl.geometry=this.geometry,Bl.material=this.material,Bl.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),Vl.copy(this.boundingSphere),Vl.applyMatrix4(n),e.ray.intersectsSphere(Vl)!==!1))for(let i=0;i<r;i++){this.getMatrixAt(i,Fl),Il.multiplyMatrices(n,Fl),Bl.matrixWorld=Il,Bl.raycast(e,Ll);for(let e=0,n=Ll.length;e<n;e++){let n=Ll[e];n.instanceId=i,n.object=this,t.push(n)}Ll.length=0}}setColorAt(e,t){return this.instanceColor===null&&(this.instanceColor=new Pl(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),t.toArray(this.instanceColor.array,e*3),this}setMatrixAt(e,t){return t.toArray(this.instanceMatrix.array,e*16),this}setMorphAt(e,t){let n=t.morphTargetInfluences,r=n.length+1;this.morphTexture===null&&(this.morphTexture=new Nl(new Float32Array(r*this.count),r,this.count,ba,ca));let i=this.morphTexture.source.data.data,a=0;for(let e=0;e<n.length;e++)a+=n[e];let o=this.geometry.morphTargetsRelative?1:1-a,s=r*e;return i[s]=o,i.set(n,s+1),this}updateMorphTargets(){}dispose(){this.dispatchEvent({type:`dispose`}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}},Ul=new J,Wl=new J,Gl=new Y,Kl=class{constructor(e=new J(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,r){return this.normal.set(e,t,n),this.constant=r,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){let r=Ul.subVectors(n,t).cross(Wl.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(r,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){let e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){let r=e.delta(Ul),i=this.normal.dot(r);if(i===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;let a=-(e.start.dot(this.normal)+this.constant)/i;return n===!0&&(a<0||a>1)?null:t.copy(e.start).addScaledVector(r,a)}intersectsLine(e){let t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){let n=t||Gl.getNormalMatrix(e),r=this.coplanarPoint(Ul).applyMatrix4(e),i=this.normal.applyMatrix3(n).normalize();return this.constant=-r.dot(i),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}},ql=new $c,Jl=new q(.5,.5),Yl=new J,Xl=class{constructor(e=new Kl,t=new Kl,n=new Kl,r=new Kl,i=new Kl,a=new Kl){this.planes=[e,t,n,r,i,a]}set(e,t,n,r,i,a){let o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(r),o[4].copy(i),o[5].copy(a),this}copy(e){let t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=So,n=!1){let r=this.planes,i=e.elements,a=i[0],o=i[1],s=i[2],c=i[3],l=i[4],u=i[5],d=i[6],f=i[7],p=i[8],m=i[9],h=i[10],g=i[11],_=i[12],v=i[13],y=i[14],b=i[15];if(r[0].setComponents(c-a,f-l,g-p,b-_).normalize(),r[1].setComponents(c+a,f+l,g+p,b+_).normalize(),r[2].setComponents(c+o,f+u,g+m,b+v).normalize(),r[3].setComponents(c-o,f-u,g-m,b-v).normalize(),n)r[4].setComponents(s,d,h,y).normalize(),r[5].setComponents(c-s,f-d,g-h,b-y).normalize();else if(r[4].setComponents(c-s,f-d,g-h,b-y).normalize(),t===2e3)r[5].setComponents(c+s,f+d,g+h,b+y).normalize();else if(t===2001)r[5].setComponents(s,d,h,y).normalize();else throw Error(`THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: `+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),ql.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{let t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),ql.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(ql)}intersectsSprite(e){return ql.center.set(0,0,0),ql.radius=.7071067811865476+Jl.distanceTo(e.center),ql.applyMatrix4(e.matrixWorld),this.intersectsSphere(ql)}intersectsSphere(e){let t=this.planes,n=e.center,r=-e.radius;for(let e=0;e<6;e++)if(t[e].distanceToPoint(n)<r)return!1;return!0}intersectsBox(e){let t=this.planes;for(let n=0;n<6;n++){let r=t[n];if(Yl.x=r.normal.x>0?e.max.x:e.min.x,Yl.y=r.normal.y>0?e.max.y:e.min.y,Yl.z=r.normal.z>0?e.max.z:e.min.z,r.distanceToPoint(Yl)<0)return!1}return!0}containsPoint(e){let t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}},Zl=class extends ll{constructor(e){super(),this.isPointsMaterial=!0,this.type=`PointsMaterial`,this.color=new X(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}},Ql=new js,$l=new _l,eu=new $c,tu=new J,nu=class extends ic{constructor(e=new sl,t=new Zl){super(),this.isPoints=!0,this.type=`Points`,this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){let n=this.geometry,r=this.matrixWorld,i=e.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),eu.copy(n.boundingSphere),eu.applyMatrix4(r),eu.radius+=i,e.ray.intersectsSphere(eu)===!1)return;Ql.copy(r).invert(),$l.copy(e.ray).applyMatrix4(Ql);let o=i/((this.scale.x+this.scale.y+this.scale.z)/3),s=o*o,c=n.index,l=n.attributes.position;if(c!==null){let n=Math.max(0,a.start),i=Math.min(c.count,a.start+a.count);for(let a=n,o=i;a<o;a++){let n=c.getX(a);tu.fromBufferAttribute(l,n),ru(tu,n,s,r,e,t,this)}}else{let n=Math.max(0,a.start),i=Math.min(l.count,a.start+a.count);for(let a=n,o=i;a<o;a++)tu.fromBufferAttribute(l,a),ru(tu,a,s,r,e,t,this)}}updateMorphTargets(){let e=this.geometry.morphAttributes,t=Object.keys(e);if(t.length>0){let n=e[t[0]];if(n!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let e=0,t=n.length;e<t;e++){let t=n[e].name||String(e);this.morphTargetInfluences.push(0),this.morphTargetDictionary[t]=e}}}}};function ru(e,t,n,r,i,a,o){let s=$l.distanceSqToPoint(e);if(s<n){let n=new J;$l.closestPointToPoint(e,n),n.applyMatrix4(r);let c=i.ray.origin.distanceTo(n);if(c<i.near||c>i.far)return;a.push({distance:c,distanceToRay:Math.sqrt(s),point:n,index:t,face:null,faceIndex:null,barycoord:null,object:o})}}var iu=class extends Ts{constructor(e=[],t=301,n,r,i,a,o,s,c,l){super(e,t,n,r,i,a,o,s,c,l),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}},au=class extends Ts{constructor(e,t,n=sa,r,i,a,o=Xi,s=Xi,c,l=va,u=1){if(l!==1026&&l!==1027)throw Error(`DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat`);super({width:e,height:t,depth:u},r,i,a,o,s,l,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new xs(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){let t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}},ou=class extends au{constructor(e,t=sa,n=301,r,i,a=Xi,o=Xi,s,c=va){let l={width:e,height:e,depth:1},u=[l,l,l,l,l,l];super(e,e,t,n,r,i,a,o,s,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}},su=class extends Ts{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}},cu=class e extends sl{constructor(e=1,t=1,n=1,r=1,i=1,a=1){super(),this.type=`BoxGeometry`,this.parameters={width:e,height:t,depth:n,widthSegments:r,heightSegments:i,depthSegments:a};let o=this;r=Math.floor(r),i=Math.floor(i),a=Math.floor(a);let s=[],c=[],l=[],u=[],d=0,f=0;p(`z`,`y`,`x`,-1,-1,n,t,e,a,i,0),p(`z`,`y`,`x`,1,-1,n,t,-e,a,i,1),p(`x`,`z`,`y`,1,1,e,n,t,r,a,2),p(`x`,`z`,`y`,1,-1,e,n,-t,r,a,3),p(`x`,`y`,`z`,1,-1,e,t,n,r,i,4),p(`x`,`y`,`z`,-1,-1,e,t,-n,r,i,5),this.setIndex(s),this.setAttribute(`position`,new Yc(c,3)),this.setAttribute(`normal`,new Yc(l,3)),this.setAttribute(`uv`,new Yc(u,2));function p(e,t,n,r,i,a,p,m,h,g,_){let v=a/h,y=p/g,b=a/2,x=p/2,S=m/2,C=h+1,w=g+1,T=0,E=0,D=new J;for(let a=0;a<w;a++){let o=a*y-x;for(let s=0;s<C;s++)D[e]=(s*v-b)*r,D[t]=o*i,D[n]=S,c.push(D.x,D.y,D.z),D[e]=0,D[t]=0,D[n]=m>0?1:-1,l.push(D.x,D.y,D.z),u.push(s/h),u.push(1-a/g),T+=1}for(let e=0;e<g;e++)for(let t=0;t<h;t++){let n=d+t+C*e,r=d+t+C*(e+1),i=d+(t+1)+C*(e+1),a=d+(t+1)+C*e;s.push(n,r,a),s.push(r,i,a),E+=6}o.addGroup(f,E,_),f+=E,d+=T}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}},lu=class e extends sl{constructor(e=1,t=1,n=1,r=1){super(),this.type=`PlaneGeometry`,this.parameters={width:e,height:t,widthSegments:n,heightSegments:r};let i=e/2,a=t/2,o=Math.floor(n),s=Math.floor(r),c=o+1,l=s+1,u=e/o,d=t/s,f=[],p=[],m=[],h=[];for(let e=0;e<l;e++){let t=e*d-a;for(let n=0;n<c;n++){let r=n*u-i;p.push(r,-t,0),m.push(0,0,1),h.push(n/o),h.push(1-e/s)}}for(let e=0;e<s;e++)for(let t=0;t<o;t++){let n=t+c*e,r=t+c*(e+1),i=t+1+c*(e+1),a=t+1+c*e;f.push(n,r,a),f.push(r,i,a)}this.setIndex(f),this.setAttribute(`position`,new Yc(p,3)),this.setAttribute(`normal`,new Yc(m,3)),this.setAttribute(`uv`,new Yc(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(t){return new e(t.width,t.height,t.widthSegments,t.heightSegments)}};function uu(e){let t={};for(let n in e){t[n]={};for(let r in e[n]){let i=e[n][r];if(fu(i))i.isRenderTargetTexture?(G(`UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms().`),t[n][r]=null):t[n][r]=i.clone();else if(Array.isArray(i))if(fu(i[0])){let e=[];for(let t=0,n=i.length;t<n;t++)e[t]=i[t].clone();t[n][r]=e}else t[n][r]=i.slice();else t[n][r]=i}}return t}function du(e){let t={};for(let n=0;n<e.length;n++){let r=uu(e[n]);for(let e in r)t[e]=r[e]}return t}function fu(e){return e&&(e.isColor||e.isMatrix3||e.isMatrix4||e.isVector2||e.isVector3||e.isVector4||e.isTexture||e.isQuaternion)}function pu(e){let t=[];for(let n=0;n<e.length;n++)t.push(e[n].clone());return t}function mu(e){let t=e.getRenderTarget();return t===null?e.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:hs.workingColorSpace}var hu={clone:uu,merge:du},gu=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,_u=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`,vu=class extends ll{constructor(e){super(),this.isShaderMaterial=!0,this.type=`ShaderMaterial`,this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=gu,this.fragmentShader=_u,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=uu(e.uniforms),this.uniformsGroups=pu(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){let t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(let n in this.uniforms){let r=this.uniforms[n].value;r&&r.isTexture?t.uniforms[n]={type:`t`,value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[n]={type:`c`,value:r.getHex()}:r&&r.isVector2?t.uniforms[n]={type:`v2`,value:r.toArray()}:r&&r.isVector3?t.uniforms[n]={type:`v3`,value:r.toArray()}:r&&r.isVector4?t.uniforms[n]={type:`v4`,value:r.toArray()}:r&&r.isMatrix3?t.uniforms[n]={type:`m3`,value:r.toArray()}:r&&r.isMatrix4?t.uniforms[n]={type:`m4`,value:r.toArray()}:t.uniforms[n]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;let n={};for(let e in this.extensions)this.extensions[e]===!0&&(n[e]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}},yu=class extends vu{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type=`RawShaderMaterial`}},bu=class extends ll{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type=`MeshStandardMaterial`,this.defines={STANDARD:``},this.color=new X(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new X(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=0,this.normalScale=new q(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new Vs,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap=`round`,this.wireframeLinejoin=`round`,this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:``},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}},xu=class extends bu{constructor(e){super(),this.isMeshPhysicalMaterial=!0,this.defines={STANDARD:``,PHYSICAL:``},this.type=`MeshPhysicalMaterial`,this.anisotropyRotation=0,this.anisotropyMap=null,this.clearcoatMap=null,this.clearcoatRoughness=0,this.clearcoatRoughnessMap=null,this.clearcoatNormalScale=new q(1,1),this.clearcoatNormalMap=null,this.ior=1.5,Object.defineProperty(this,"reflectivity",{get:function(){return Bo(2.5*(this.ior-1)/(this.ior+1),0,1)},set:function(e){this.ior=(1+.4*e)/(1-.4*e)}}),this.iridescenceMap=null,this.iridescenceIOR=1.3,this.iridescenceThicknessRange=[100,400],this.iridescenceThicknessMap=null,this.sheenColor=new X(0),this.sheenColorMap=null,this.sheenRoughness=1,this.sheenRoughnessMap=null,this.transmissionMap=null,this.thickness=0,this.thicknessMap=null,this.attenuationDistance=1/0,this.attenuationColor=new X(1,1,1),this.specularIntensity=1,this.specularIntensityMap=null,this.specularColor=new X(1,1,1),this.specularColorMap=null,this._anisotropy=0,this._clearcoat=0,this._dispersion=0,this._iridescence=0,this._sheen=0,this._transmission=0,this.setValues(e)}get anisotropy(){return this._anisotropy}set anisotropy(e){this._anisotropy>0!=e>0&&this.version++,this._anisotropy=e}get clearcoat(){return this._clearcoat}set clearcoat(e){this._clearcoat>0!=e>0&&this.version++,this._clearcoat=e}get iridescence(){return this._iridescence}set iridescence(e){this._iridescence>0!=e>0&&this.version++,this._iridescence=e}get dispersion(){return this._dispersion}set dispersion(e){this._dispersion>0!=e>0&&this.version++,this._dispersion=e}get sheen(){return this._sheen}set sheen(e){this._sheen>0!=e>0&&this.version++,this._sheen=e}get transmission(){return this._transmission}set transmission(e){this._transmission>0!=e>0&&this.version++,this._transmission=e}copy(e){return super.copy(e),this.defines={STANDARD:``,PHYSICAL:``},this.anisotropy=e.anisotropy,this.anisotropyRotation=e.anisotropyRotation,this.anisotropyMap=e.anisotropyMap,this.clearcoat=e.clearcoat,this.clearcoatMap=e.clearcoatMap,this.clearcoatRoughness=e.clearcoatRoughness,this.clearcoatRoughnessMap=e.clearcoatRoughnessMap,this.clearcoatNormalMap=e.clearcoatNormalMap,this.clearcoatNormalScale.copy(e.clearcoatNormalScale),this.dispersion=e.dispersion,this.ior=e.ior,this.iridescence=e.iridescence,this.iridescenceMap=e.iridescenceMap,this.iridescenceIOR=e.iridescenceIOR,this.iridescenceThicknessRange=[...e.iridescenceThicknessRange],this.iridescenceThicknessMap=e.iridescenceThicknessMap,this.sheen=e.sheen,this.sheenColor.copy(e.sheenColor),this.sheenColorMap=e.sheenColorMap,this.sheenRoughness=e.sheenRoughness,this.sheenRoughnessMap=e.sheenRoughnessMap,this.transmission=e.transmission,this.transmissionMap=e.transmissionMap,this.thickness=e.thickness,this.thicknessMap=e.thicknessMap,this.attenuationDistance=e.attenuationDistance,this.attenuationColor.copy(e.attenuationColor),this.specularIntensity=e.specularIntensity,this.specularIntensityMap=e.specularIntensityMap,this.specularColor.copy(e.specularColor),this.specularColorMap=e.specularColorMap,this}},Su=class extends ll{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type=`MeshDepthMaterial`,this.depthPacking=ho,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}},Cu=class extends ll{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type=`MeshDistanceMaterial`,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}};function wu(e,t){return!e||e.constructor===t?e:typeof t.BYTES_PER_ELEMENT==`number`?new t(e):Array.prototype.slice.call(e)}var Tu=class{constructor(e,t,n,r){this.parameterPositions=e,this._cachedIndex=0,this.resultBuffer=r===void 0?new t.constructor(n):r,this.sampleValues=t,this.valueSize=n,this.settings=null,this.DefaultSettings_={}}evaluate(e){let t=this.parameterPositions,n=this._cachedIndex,r=t[n],i=t[n-1];validate_interval:{seek:{let a;linear_scan:{forward_scan:if(!(e<r)){for(let a=n+2;;){if(r===void 0){if(e<i)break forward_scan;return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}if(n===a)break;if(i=r,r=t[++n],e<r)break seek}a=t.length;break linear_scan}if(!(e>=i)){let o=t[1];e<o&&(n=2,i=o);for(let a=n-2;;){if(i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(n===a)break;if(r=i,i=t[--n-1],e>=i)break seek}a=n,n=0;break linear_scan}break validate_interval}for(;n<a;){let r=n+a>>>1;e<t[r]?a=r:n=r+1}if(r=t[n],i=t[n-1],i===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(r===void 0)return n=t.length,this._cachedIndex=n,this.copySampleValue_(n-1)}this._cachedIndex=n,this.intervalChanged_(n,i,r)}return this.interpolate_(n,i,e,r)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_(e){let t=this.resultBuffer,n=this.sampleValues,r=this.valueSize,i=e*r;for(let e=0;e!==r;++e)t[e]=n[i+e];return t}interpolate_(){throw Error(`call to abstract method`)}intervalChanged_(){}},Eu=class extends Tu{constructor(e,t,n,r){super(e,t,n,r),this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:fo,endingEnd:fo}}intervalChanged_(e,t,n){let r=this.parameterPositions,i=e-2,a=e+1,o=r[i],s=r[a];if(o===void 0)switch(this.getSettings_().endingStart){case po:i=e,o=2*t-n;break;case mo:i=r.length-2,o=t+r[i]-r[i+1];break;default:i=e,o=n}if(s===void 0)switch(this.getSettings_().endingEnd){case po:a=e,s=2*n-t;break;case mo:a=1,s=n+r[1]-r[0];break;default:a=e-1,s=t}let c=(n-t)*.5,l=this.valueSize;this._weightPrev=c/(t-o),this._weightNext=c/(s-n),this._offsetPrev=i*l,this._offsetNext=a*l}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this._offsetPrev,u=this._offsetNext,d=this._weightPrev,f=this._weightNext,p=(n-t)/(r-t),m=p*p,h=m*p,g=-d*h+2*d*m-d*p,_=(1+d)*h+(-1.5-2*d)*m+(-.5+d)*p+1,v=(-1-f)*h+(1.5+f)*m+.5*p,y=f*h-f*m;for(let e=0;e!==o;++e)i[e]=g*a[l+e]+_*a[c+e]+v*a[s+e]+y*a[u+e];return i}},Du=class extends Tu{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=(n-t)/(r-t),u=1-l;for(let e=0;e!==o;++e)i[e]=a[c+e]*u+a[s+e]*l;return i}},Ou=class extends Tu{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e){return this.copySampleValue_(e-1)}},ku=class extends Tu{interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=e*o,c=s-o,l=this.settings||this.DefaultSettings_,u=l.inTangents,d=l.outTangents;if(!u||!d){let e=(n-t)/(r-t),l=1-e;for(let t=0;t!==o;++t)i[t]=a[c+t]*l+a[s+t]*e;return i}let f=o*2,p=e-1;for(let l=0;l!==o;++l){let o=a[c+l],m=a[s+l],h=p*f+l*2,g=d[h],_=d[h+1],v=e*f+l*2,y=u[v],b=u[v+1],x=(n-t)/(r-t),S,C,w,T,E;for(let e=0;e<8;e++){S=x*x,C=S*x,w=1-x,T=w*w,E=T*w;let e=E*t+3*T*x*g+3*w*S*y+C*r-n;if(Math.abs(e)<1e-10)break;let i=3*T*(g-t)+6*w*x*(y-g)+3*S*(r-y);if(Math.abs(i)<1e-10)break;x-=e/i,x=Math.max(0,Math.min(1,x))}i[l]=E*o+3*T*x*_+3*w*S*b+C*m}return i}},Au=class{constructor(e,t,n,r){if(e===void 0)throw Error(`THREE.KeyframeTrack: track name is undefined`);if(t===void 0||t.length===0)throw Error(`THREE.KeyframeTrack: no keyframes in track named `+e);this.name=e,this.times=wu(t,this.TimeBufferType),this.values=wu(n,this.ValueBufferType),this.setInterpolation(r||this.DefaultInterpolation)}static toJSON(e){let t=e.constructor,n;if(t.toJSON!==this.toJSON)n=t.toJSON(e);else{n={name:e.name,times:wu(e.times,Array),values:wu(e.values,Array)};let t=e.getInterpolation();t!==e.DefaultInterpolation&&(n.interpolation=t)}return n.type=e.ValueTypeName,n}InterpolantFactoryMethodDiscrete(e){return new Ou(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodLinear(e){return new Du(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodSmooth(e){return new Eu(this.times,this.values,this.getValueSize(),e)}InterpolantFactoryMethodBezier(e){let t=new ku(this.times,this.values,this.getValueSize(),e);return this.settings&&(t.settings=this.settings),t}setInterpolation(e){let t;switch(e){case so:t=this.InterpolantFactoryMethodDiscrete;break;case co:t=this.InterpolantFactoryMethodLinear;break;case lo:t=this.InterpolantFactoryMethodSmooth;break;case uo:t=this.InterpolantFactoryMethodBezier;break}if(t===void 0){let t=`unsupported interpolation for `+this.ValueTypeName+` keyframe track named `+this.name;if(this.createInterpolant===void 0)if(e!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(t);return G(`KeyframeTrack:`,t),this}return this.createInterpolant=t,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return so;case this.InterpolantFactoryMethodLinear:return co;case this.InterpolantFactoryMethodSmooth:return lo;case this.InterpolantFactoryMethodBezier:return uo}}getValueSize(){return this.values.length/this.times.length}shift(e){if(e!==0){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]+=e}return this}scale(e){if(e!==1){let t=this.times;for(let n=0,r=t.length;n!==r;++n)t[n]*=e}return this}trim(e,t){let n=this.times,r=n.length,i=0,a=r-1;for(;i!==r&&n[i]<e;)++i;for(;a!==-1&&n[a]>t;)--a;if(++a,i!==0||a!==r){i>=a&&(a=Math.max(a,1),i=a-1);let e=this.getValueSize();this.times=n.slice(i,a),this.values=this.values.slice(i*e,a*e)}return this}validate(){let e=!0,t=this.getValueSize();t-Math.floor(t)!==0&&(K(`KeyframeTrack: Invalid value size in track.`,this),e=!1);let n=this.times,r=this.values,i=n.length;i===0&&(K(`KeyframeTrack: Track is empty.`,this),e=!1);let a=null;for(let t=0;t!==i;t++){let r=n[t];if(typeof r==`number`&&isNaN(r)){K(`KeyframeTrack: Time is not a valid number.`,this,t,r),e=!1;break}if(a!==null&&a>r){K(`KeyframeTrack: Out of order keys.`,this,t,r,a),e=!1;break}a=r}if(r!==void 0&&wo(r))for(let t=0,n=r.length;t!==n;++t){let n=r[t];if(isNaN(n)){K(`KeyframeTrack: Value is not a valid number.`,this,t,n),e=!1;break}}return e}optimize(){let e=this.times.slice(),t=this.values.slice(),n=this.getValueSize(),r=this.getInterpolation()===lo,i=e.length-1,a=1;for(let o=1;o<i;++o){let i=!1,s=e[o];if(s!==e[o+1]&&(o!==1||s!==e[0]))if(r)i=!0;else{let e=o*n,r=e-n,a=e+n;for(let o=0;o!==n;++o){let n=t[e+o];if(n!==t[r+o]||n!==t[a+o]){i=!0;break}}}if(i){if(o!==a){e[a]=e[o];let r=o*n,i=a*n;for(let e=0;e!==n;++e)t[i+e]=t[r+e]}++a}}if(i>0){e[a]=e[i];for(let e=i*n,r=a*n,o=0;o!==n;++o)t[r+o]=t[e+o];++a}return a===e.length?(this.times=e,this.values=t):(this.times=e.slice(0,a),this.values=t.slice(0,a*n)),this}clone(){let e=this.times.slice(),t=this.values.slice(),n=this.constructor,r=new n(this.name,e,t);return r.createInterpolant=this.createInterpolant,r}};Au.prototype.ValueTypeName=``,Au.prototype.TimeBufferType=Float32Array,Au.prototype.ValueBufferType=Float32Array,Au.prototype.DefaultInterpolation=co;var ju=class extends Au{constructor(e,t,n){super(e,t,n)}};ju.prototype.ValueTypeName=`bool`,ju.prototype.ValueBufferType=Array,ju.prototype.DefaultInterpolation=so,ju.prototype.InterpolantFactoryMethodLinear=void 0,ju.prototype.InterpolantFactoryMethodSmooth=void 0;var Mu=class extends Au{constructor(e,t,n,r){super(e,t,n,r)}};Mu.prototype.ValueTypeName=`color`;var Nu=class extends Au{constructor(e,t,n,r){super(e,t,n,r)}};Nu.prototype.ValueTypeName=`number`;var Pu=class extends Tu{constructor(e,t,n,r){super(e,t,n,r)}interpolate_(e,t,n,r){let i=this.resultBuffer,a=this.sampleValues,o=this.valueSize,s=(n-t)/(r-t),c=e*o;for(let e=c+o;c!==e;c+=4)cs.slerpFlat(i,0,a,c-o,a,c,s);return i}},Fu=class extends Au{constructor(e,t,n,r){super(e,t,n,r)}InterpolantFactoryMethodLinear(e){return new Pu(this.times,this.values,this.getValueSize(),e)}};Fu.prototype.ValueTypeName=`quaternion`,Fu.prototype.InterpolantFactoryMethodSmooth=void 0;var Iu=class extends Au{constructor(e,t,n){super(e,t,n)}};Iu.prototype.ValueTypeName=`string`,Iu.prototype.ValueBufferType=Array,Iu.prototype.DefaultInterpolation=so,Iu.prototype.InterpolantFactoryMethodLinear=void 0,Iu.prototype.InterpolantFactoryMethodSmooth=void 0;var Lu=class extends Au{constructor(e,t,n,r){super(e,t,n,r)}};Lu.prototype.ValueTypeName=`vector`;var Ru=new class{constructor(e,t,n){let r=this,i=!1,a=0,o=0,s,c=[];this.onStart=void 0,this.onLoad=e,this.onProgress=t,this.onError=n,this._abortController=null,this.itemStart=function(e){o++,i===!1&&r.onStart!==void 0&&r.onStart(e,a,o),i=!0},this.itemEnd=function(e){a++,r.onProgress!==void 0&&r.onProgress(e,a,o),a===o&&(i=!1,r.onLoad!==void 0&&r.onLoad())},this.itemError=function(e){r.onError!==void 0&&r.onError(e)},this.resolveURL=function(e){return s?s(e):e},this.setURLModifier=function(e){return s=e,this},this.addHandler=function(e,t){return c.push(e,t),this},this.removeHandler=function(e){let t=c.indexOf(e);return t!==-1&&c.splice(t,2),this},this.getHandler=function(e){for(let t=0,n=c.length;t<n;t+=2){let n=c[t],r=c[t+1];if(n.global&&(n.lastIndex=0),n.test(e))return r}return null},this.abort=function(){return this.abortController.abort(),this._abortController=null,this}}get abortController(){return this._abortController||=new AbortController,this._abortController}},zu=class{constructor(e){this.manager=e===void 0?Ru:e,this.crossOrigin=`anonymous`,this.withCredentials=!1,this.path=``,this.resourcePath=``,this.requestHeader={},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}load(){}loadAsync(e,t){let n=this;return new Promise(function(r,i){n.load(e,r,t,i)})}parse(){}setCrossOrigin(e){return this.crossOrigin=e,this}setWithCredentials(e){return this.withCredentials=e,this}setPath(e){return this.path=e,this}setResourcePath(e){return this.resourcePath=e,this}setRequestHeader(e){return this.requestHeader=e,this}abort(){return this}};zu.DEFAULT_MATERIAL_NAME=`__DEFAULT`;var Bu=class extends ic{constructor(e,t=1){super(),this.isLight=!0,this.type=`Light`,this.color=new X(e),this.intensity=t}dispose(){this.dispatchEvent({type:`dispose`})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){let t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}},Vu=new js,Hu=new J,Uu=new J,Wu=class{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new q(512,512),this.mapType=na,this.map=null,this.mapPass=null,this.matrix=new js,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new Xl,this._frameExtents=new q(1,1),this._viewportCount=1,this._viewports=[new Es(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){let t=this.camera,n=this.matrix;Hu.setFromMatrixPosition(e.matrixWorld),t.position.copy(Hu),Uu.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(Uu),t.updateMatrixWorld(),Vu.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Vu,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===2001||t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Vu)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){let e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}},Gu=new J,Ku=new cs,qu=new J,Ju=class extends ic{constructor(){super(),this.isCamera=!0,this.type=`Camera`,this.matrixWorldInverse=new js,this.projectionMatrix=new js,this.projectionMatrixInverse=new js,this.coordinateSystem=So,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Gu,Ku,qu),qu.x===1&&qu.y===1&&qu.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Gu,Ku,qu.set(1,1,1)).invert()}updateWorldMatrix(e,t){super.updateWorldMatrix(e,t),this.matrixWorld.decompose(Gu,Ku,qu),qu.x===1&&qu.y===1&&qu.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Gu,Ku,qu.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}},Yu=new J,Xu=new q,Zu=new q,Qu=class extends Ju{constructor(e=50,t=1,n=.1,r=2e3){super(),this.isPerspectiveCamera=!0,this.type=`PerspectiveCamera`,this.fov=e,this.zoom=1,this.near=n,this.far=r,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){let t=.5*this.getFilmHeight()/e;this.fov=Ro*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){let e=Math.tan(Lo*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Ro*2*Math.atan(Math.tan(Lo*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){Yu.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(Yu.x,Yu.y).multiplyScalar(-e/Yu.z),Yu.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Yu.x,Yu.y).multiplyScalar(-e/Yu.z)}getViewSize(e,t){return this.getViewBounds(e,Xu,Zu),t.subVectors(Zu,Xu)}setViewOffset(e,t,n,r,i,a){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=this.near,t=e*Math.tan(Lo*.5*this.fov)/this.zoom,n=2*t,r=this.aspect*n,i=-.5*r,a=this.view;if(this.view!==null&&this.view.enabled){let e=a.fullWidth,o=a.fullHeight;i+=a.offsetX*r/e,t-=a.offsetY*n/o,r*=a.width/e,n*=a.height/o}let o=this.filmOffset;o!==0&&(i+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(i,i+r,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}},$u=class extends Wu{constructor(){super(new Qu(90,1,.5,500)),this.isPointLightShadow=!0}},ed=class extends Bu{constructor(e,t,n=0,r=2){super(e,t),this.isPointLight=!0,this.type=`PointLight`,this.distance=n,this.decay=r,this.shadow=new $u}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}},td=class extends Ju{constructor(e=-1,t=1,n=1,r=-1,i=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type=`OrthographicCamera`,this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=r,this.near=i,this.far=a,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,r,i,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=r,this.view.width=i,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){let e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,r=(this.top+this.bottom)/2,i=n-e,a=n+e,o=r+t,s=r-t;if(this.view!==null&&this.view.enabled){let e=(this.right-this.left)/this.view.fullWidth/this.zoom,t=(this.top-this.bottom)/this.view.fullHeight/this.zoom;i+=e*this.view.offsetX,a=i+e*this.view.width,o-=t*this.view.offsetY,s=o-t*this.view.height}this.projectionMatrix.makeOrthographic(i,a,o,s,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){let t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}},nd=class extends Wu{constructor(){super(new td(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}},rd=class extends Bu{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type=`DirectionalLight`,this.position.copy(ic.DEFAULT_UP),this.updateMatrix(),this.target=new ic,this.shadow=new nd}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){let t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}},id=class extends Bu{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type=`AmbientLight`}},ad=-90,od=1,sd=class extends ic{constructor(e,t,n){super(),this.type=`CubeCamera`,this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;let r=new Qu(ad,od,e,t);r.layers=this.layers,this.add(r);let i=new Qu(ad,od,e,t);i.layers=this.layers,this.add(i);let a=new Qu(ad,od,e,t);a.layers=this.layers,this.add(a);let o=new Qu(ad,od,e,t);o.layers=this.layers,this.add(o);let s=new Qu(ad,od,e,t);s.layers=this.layers,this.add(s);let c=new Qu(ad,od,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){let e=this.coordinateSystem,t=this.children.concat(),[n,r,i,a,o,s]=t;for(let e of t)this.remove(e);if(e===2e3)n.up.set(0,1,0),n.lookAt(1,0,0),r.up.set(0,1,0),r.lookAt(-1,0,0),i.up.set(0,0,-1),i.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),s.up.set(0,1,0),s.lookAt(0,0,-1);else if(e===2001)n.up.set(0,-1,0),n.lookAt(-1,0,0),r.up.set(0,-1,0),r.lookAt(1,0,0),i.up.set(0,0,1),i.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),s.up.set(0,-1,0),s.lookAt(0,0,-1);else throw Error(`THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: `+e);for(let e of t)this.add(e),e.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();let{renderTarget:n,activeMipmapLevel:r}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());let[i,a,o,s,c,l]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),f=e.getActiveMipmapLevel(),p=e.xr.enabled;e.xr.enabled=!1;let m=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let h=!1;h=e.isWebGLRenderer===!0?e.state.buffers.depth.getReversed():e.reversedDepthBuffer,e.setRenderTarget(n,0,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,i),e.setRenderTarget(n,1,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,2,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,s),e.setRenderTarget(n,4,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=m,e.setRenderTarget(n,5,r),h&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(u,d,f),e.xr.enabled=p,n.texture.needsPMREMUpdate=!0}},cd=class extends Qu{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}},ld=`\\[\\]\\.:\\/`,ud=RegExp(`[\\[\\]\\.:\\/]`,`g`),dd=`[^\\[\\]\\.:\\/]`,fd=`[^`+ld.replace(`\\.`,``)+`]`,pd=`((?:WC+[\\/:])*)`.replace(`WC`,dd),md=`(WCOD+)?`.replace(`WCOD`,fd),hd=`(?:\\.(WC+)(?:\\[(.+)\\])?)?`.replace(`WC`,dd),gd=`\\.(WC+)(?:\\[(.+)\\])?`.replace(`WC`,dd),_d=RegExp(`^`+pd+md+hd+gd+`$`),vd=[`material`,`materials`,`bones`,`map`],yd=class{constructor(e,t,n){let r=n||bd.parseTrackName(t);this._targetGroup=e,this._bindings=e.subscribe_(t,r)}getValue(e,t){this.bind();let n=this._targetGroup.nCachedObjects_,r=this._bindings[n];r!==void 0&&r.getValue(e,t)}setValue(e,t){let n=this._bindings;for(let r=this._targetGroup.nCachedObjects_,i=n.length;r!==i;++r)n[r].setValue(e,t)}bind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].bind()}unbind(){let e=this._bindings;for(let t=this._targetGroup.nCachedObjects_,n=e.length;t!==n;++t)e[t].unbind()}},bd=class e{constructor(t,n,r){this.path=n,this.parsedPath=r||e.parseTrackName(n),this.node=e.findNode(t,this.parsedPath.nodeName),this.rootNode=t,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create(t,n,r){return t&&t.isAnimationObjectGroup?new e.Composite(t,n,r):new e(t,n,r)}static sanitizeNodeName(e){return e.replace(/\s/g,`_`).replace(ud,``)}static parseTrackName(e){let t=_d.exec(e);if(t===null)throw Error(`PropertyBinding: Cannot parse trackName: `+e);let n={nodeName:t[2],objectName:t[3],objectIndex:t[4],propertyName:t[5],propertyIndex:t[6]},r=n.nodeName&&n.nodeName.lastIndexOf(`.`);if(r!==void 0&&r!==-1){let e=n.nodeName.substring(r+1);vd.indexOf(e)!==-1&&(n.nodeName=n.nodeName.substring(0,r),n.objectName=e)}if(n.propertyName===null||n.propertyName.length===0)throw Error(`PropertyBinding: can not parse propertyName from trackName: `+e);return n}static findNode(e,t){if(t===void 0||t===``||t===`.`||t===-1||t===e.name||t===e.uuid)return e;if(e.skeleton){let n=e.skeleton.getBoneByName(t);if(n!==void 0)return n}if(e.children){let n=function(e){for(let r=0;r<e.length;r++){let i=e[r];if(i.name===t||i.uuid===t)return i;let a=n(i.children);if(a)return a}return null},r=n(e.children);if(r)return r}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct(e,t){e[t]=this.targetObject[this.propertyName]}_getValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)e[t++]=n[r]}_getValue_arrayElement(e,t){e[t]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray(e,t){this.resolvedProperty.toArray(e,t)}_setValue_direct(e,t){this.targetObject[this.propertyName]=e[t]}_setValue_direct_setNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate(e,t){this.targetObject[this.propertyName]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++]}_setValue_array_setNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate(e,t){let n=this.resolvedProperty;for(let r=0,i=n.length;r!==i;++r)n[r]=e[t++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement(e,t){this.resolvedProperty[this.propertyIndex]=e[t]}_setValue_arrayElement_setNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty[this.propertyIndex]=e[t],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray(e,t){this.resolvedProperty.fromArray(e,t)}_setValue_fromArray_setNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate(e,t){this.resolvedProperty.fromArray(e,t),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound(e,t){this.bind(),this.getValue(e,t)}_setValue_unbound(e,t){this.bind(),this.setValue(e,t)}bind(){let t=this.node,n=this.parsedPath,r=n.objectName,i=n.propertyName,a=n.propertyIndex;if(t||(t=e.findNode(this.rootNode,n.nodeName),this.node=t),this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!t){G(`PropertyBinding: No target node found for track: `+this.path+`.`);return}if(r){let e=n.objectIndex;switch(r){case`materials`:if(!t.material){K(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.materials){K(`PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.`,this);return}t=t.material.materials;break;case`bones`:if(!t.skeleton){K(`PropertyBinding: Can not bind to bones as node does not have a skeleton.`,this);return}t=t.skeleton.bones;for(let n=0;n<t.length;n++)if(t[n].name===e){e=n;break}break;case`map`:if(`map`in t){t=t.map;break}if(!t.material){K(`PropertyBinding: Can not bind to material as node does not have a material.`,this);return}if(!t.material.map){K(`PropertyBinding: Can not bind to material.map as node.material does not have a map.`,this);return}t=t.material.map;break;default:if(t[r]===void 0){K(`PropertyBinding: Can not bind to objectName of node undefined.`,this);return}t=t[r]}if(e!==void 0){if(t[e]===void 0){K(`PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.`,this,t);return}t=t[e]}}let o=t[i];if(o===void 0){let e=n.nodeName;K(`PropertyBinding: Trying to update property for track: `+e+`.`+i+` but it wasn't found.`,t);return}let s=this.Versioning.None;this.targetObject=t,t.isMaterial===!0?s=this.Versioning.NeedsUpdate:t.isObject3D===!0&&(s=this.Versioning.MatrixWorldNeedsUpdate);let c=this.BindingType.Direct;if(a!==void 0){if(i===`morphTargetInfluences`){if(!t.geometry){K(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.`,this);return}if(!t.geometry.morphAttributes){K(`PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.`,this);return}t.morphTargetDictionary[a]!==void 0&&(a=t.morphTargetDictionary[a])}c=this.BindingType.ArrayElement,this.resolvedProperty=o,this.propertyIndex=a}else o.fromArray!==void 0&&o.toArray!==void 0?(c=this.BindingType.HasFromToArray,this.resolvedProperty=o):Array.isArray(o)?(c=this.BindingType.EntireArray,this.resolvedProperty=o):this.propertyName=i;this.getValue=this.GetterByBindingType[c],this.setValue=this.SetterByBindingTypeAndVersioning[c][s]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}};bd.Composite=yd,bd.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3},bd.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2},bd.prototype.GetterByBindingType=[bd.prototype._getValue_direct,bd.prototype._getValue_array,bd.prototype._getValue_arrayElement,bd.prototype._getValue_toArray],bd.prototype.SetterByBindingTypeAndVersioning=[[bd.prototype._setValue_direct,bd.prototype._setValue_direct_setNeedsUpdate,bd.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[bd.prototype._setValue_array,bd.prototype._setValue_array_setNeedsUpdate,bd.prototype._setValue_array_setMatrixWorldNeedsUpdate],[bd.prototype._setValue_arrayElement,bd.prototype._setValue_arrayElement_setNeedsUpdate,bd.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[bd.prototype._setValue_fromArray,bd.prototype._setValue_fromArray_setNeedsUpdate,bd.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var xd=new js,Sd=class{constructor(e,t,n=0,r=1/0){this.ray=new _l(e,t),this.near=n,this.far=r,this.camera=null,this.layers=new Hs,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(e,t){this.ray.set(e,t)}setFromCamera(e,t){t.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(e.x,e.y,.5).unproject(t).sub(this.ray.origin).normalize(),this.camera=t):t.isOrthographicCamera?(this.ray.origin.set(e.x,e.y,(t.near+t.far)/(t.near-t.far)).unproject(t),this.ray.direction.set(0,0,-1).transformDirection(t.matrixWorld),this.camera=t):K(`Raycaster: Unsupported camera type: `+t.type)}setFromXRController(e){return xd.identity().extractRotation(e.matrixWorld),this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(xd),this}intersectObject(e,t=!0,n=[]){return wd(e,this,n,t),n.sort(Cd),n}intersectObjects(e,t=!0,n=[]){for(let r=0,i=e.length;r<i;r++)wd(e[r],this,n,t);return n.sort(Cd),n}};function Cd(e,t){return e.distance-t.distance}function wd(e,t,n,r){let i=!0;if(e.layers.test(t.layers)&&e.raycast(t,n)===!1&&(i=!1),i===!0&&r===!0){let r=e.children;for(let e=0,i=r.length;e<i;e++)wd(r[e],t,n,!0)}}var Td=class{constructor(e=1,t=0,n=0){this.radius=e,this.phi=t,this.theta=n}set(e,t,n){return this.radius=e,this.phi=t,this.theta=n,this}copy(e){return this.radius=e.radius,this.phi=e.phi,this.theta=e.theta,this}makeSafe(){let e=1e-6;return this.phi=Bo(this.phi,e,Math.PI-e),this}setFromVector3(e){return this.setFromCartesianCoords(e.x,e.y,e.z)}setFromCartesianCoords(e,t,n){return this.radius=Math.sqrt(e*e+t*t+n*n),this.radius===0?(this.theta=0,this.phi=0):(this.theta=Math.atan2(e,n),this.phi=Math.acos(Bo(t/this.radius,-1,1))),this}clone(){return new this.constructor().copy(this)}};(class e{static{e.prototype.isMatrix2=!0}constructor(e,t,n,r){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,r)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,r){let i=this.elements;return i[0]=e,i[2]=t,i[1]=n,i[3]=r,this}});var Ed=class extends Po{constructor(e,t=null){super(),this.object=e,this.domElement=t,this.enabled=!0,this.state=-1,this.keys={},this.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:null},this.touches={ONE:null,TWO:null}}connect(e){if(e===void 0){G(`Controls: connect() now requires an element.`);return}this.domElement!==null&&this.disconnect(),this.domElement=e}disconnect(){}dispose(){}update(){}};function Dd(e,t,n,r){let i=Od(r);switch(n){case ha:return e*t;case ba:return e*t/i.components*i.byteLength;case xa:return e*t/i.components*i.byteLength;case Sa:return e*t*2/i.components*i.byteLength;case Ca:return e*t*2/i.components*i.byteLength;case ga:return e*t*3/i.components*i.byteLength;case _a:return e*t*4/i.components*i.byteLength;case wa:return e*t*4/i.components*i.byteLength;case Ta:case Ea:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Da:case Oa:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Aa:case Ma:return Math.max(e,16)*Math.max(t,8)/4;case ka:case ja:return Math.max(e,8)*Math.max(t,8)/2;case Na:case Pa:case Ia:case La:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*8;case Fa:case Ra:case za:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Ba:return Math.floor((e+3)/4)*Math.floor((t+3)/4)*16;case Va:return Math.floor((e+4)/5)*Math.floor((t+3)/4)*16;case Ha:return Math.floor((e+4)/5)*Math.floor((t+4)/5)*16;case Ua:return Math.floor((e+5)/6)*Math.floor((t+4)/5)*16;case Wa:return Math.floor((e+5)/6)*Math.floor((t+5)/6)*16;case Ga:return Math.floor((e+7)/8)*Math.floor((t+4)/5)*16;case Ka:return Math.floor((e+7)/8)*Math.floor((t+5)/6)*16;case qa:return Math.floor((e+7)/8)*Math.floor((t+7)/8)*16;case Ja:return Math.floor((e+9)/10)*Math.floor((t+4)/5)*16;case Ya:return Math.floor((e+9)/10)*Math.floor((t+5)/6)*16;case Xa:return Math.floor((e+9)/10)*Math.floor((t+7)/8)*16;case Za:return Math.floor((e+9)/10)*Math.floor((t+9)/10)*16;case Qa:return Math.floor((e+11)/12)*Math.floor((t+9)/10)*16;case $a:return Math.floor((e+11)/12)*Math.floor((t+11)/12)*16;case eo:case to:case no:return Math.ceil(e/4)*Math.ceil(t/4)*16;case ro:case io:return Math.ceil(e/4)*Math.ceil(t/4)*8;case ao:case oo:return Math.ceil(e/4)*Math.ceil(t/4)*16}throw Error(`Unable to determine texture byte length for ${n} format.`)}function Od(e){switch(e){case na:case ra:return{byteLength:1,components:1};case aa:case ia:case la:return{byteLength:2,components:1};case ua:case da:return{byteLength:2,components:4};case sa:case oa:case ca:return{byteLength:4,components:1};case pa:case ma:return{byteLength:4,components:3}}throw Error(`Unknown texture type ${e}.`)}typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`register`,{detail:{revision:`184`}})),typeof window<`u`&&(window.__THREE__?G(`WARNING: Multiple instances of Three.js being imported.`):window.__THREE__=`184`);function kd(){let e=null,t=!1,n=null,r=null;function i(t,a){n(t,a),r=e.requestAnimationFrame(i)}return{start:function(){t!==!0&&n!==null&&e!==null&&(r=e.requestAnimationFrame(i),t=!0)},stop:function(){e!==null&&e.cancelAnimationFrame(r),t=!1},setAnimationLoop:function(e){n=e},setContext:function(t){e=t}}}function Ad(e){let t=new WeakMap;function n(t,n){let r=t.array,i=t.usage,a=r.byteLength,o=e.createBuffer();e.bindBuffer(n,o),e.bufferData(n,r,i),t.onUploadCallback();let s;if(r instanceof Float32Array)s=e.FLOAT;else if(typeof Float16Array<`u`&&r instanceof Float16Array)s=e.HALF_FLOAT;else if(r instanceof Uint16Array)s=t.isFloat16BufferAttribute?e.HALF_FLOAT:e.UNSIGNED_SHORT;else if(r instanceof Int16Array)s=e.SHORT;else if(r instanceof Uint32Array)s=e.UNSIGNED_INT;else if(r instanceof Int32Array)s=e.INT;else if(r instanceof Int8Array)s=e.BYTE;else if(r instanceof Uint8Array)s=e.UNSIGNED_BYTE;else if(r instanceof Uint8ClampedArray)s=e.UNSIGNED_BYTE;else throw Error(`THREE.WebGLAttributes: Unsupported buffer data format: `+r);return{buffer:o,type:s,bytesPerElement:r.BYTES_PER_ELEMENT,version:t.version,size:a}}function r(t,n,r){let i=n.array,a=n.updateRanges;if(e.bindBuffer(r,t),a.length===0)e.bufferSubData(r,0,i);else{a.sort((e,t)=>e.start-t.start);let t=0;for(let e=1;e<a.length;e++){let n=a[t],r=a[e];r.start<=n.start+n.count+1?n.count=Math.max(n.count,r.start+r.count-n.start):(++t,a[t]=r)}a.length=t+1;for(let t=0,n=a.length;t<n;t++){let n=a[t];e.bufferSubData(r,n.start*i.BYTES_PER_ELEMENT,i,n.start,n.count)}n.clearUpdateRanges()}n.onUploadCallback()}function i(e){return e.isInterleavedBufferAttribute&&(e=e.data),t.get(e)}function a(n){n.isInterleavedBufferAttribute&&(n=n.data);let r=t.get(n);r&&(e.deleteBuffer(r.buffer),t.delete(n))}function o(e,i){if(e.isInterleavedBufferAttribute&&(e=e.data),e.isGLBufferAttribute){let n=t.get(e);(!n||n.version<e.version)&&t.set(e,{buffer:e.buffer,type:e.type,bytesPerElement:e.elementSize,version:e.version});return}let a=t.get(e);if(a===void 0)t.set(e,n(e,i));else if(a.version<e.version){if(a.size!==e.array.byteLength)throw Error(`THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.`);r(a.buffer,e,i),a.version=e.version}}return{get:i,remove:a,update:o}}var jd={alphahash_fragment:`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,alphahash_pars_fragment:`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,alphamap_fragment:`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,alphamap_pars_fragment:`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,alphatest_fragment:`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,alphatest_pars_fragment:`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,aomap_fragment:`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,aomap_pars_fragment:`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,batching_pars_vertex:`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,batching_vertex:`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,begin_vertex:`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,beginnormal_vertex:`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,bsdfs:`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,iridescence_fragment:`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,bumpmap_pars_fragment:`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,clipping_planes_fragment:`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,clipping_planes_pars_fragment:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,clipping_planes_pars_vertex:`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,clipping_planes_vertex:`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,color_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,color_pars_fragment:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,color_pars_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,color_vertex:`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,common:`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,cube_uv_reflection_fragment:`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,defaultnormal_vertex:`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,displacementmap_pars_vertex:`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,displacementmap_vertex:`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,emissivemap_fragment:`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,emissivemap_pars_fragment:`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,colorspace_fragment:`gl_FragColor = linearToOutputTexel( gl_FragColor );`,colorspace_pars_fragment:`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,envmap_fragment:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,envmap_common_pars_fragment:`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,envmap_pars_fragment:`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,envmap_pars_vertex:`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,envmap_physical_pars_fragment:`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,envmap_vertex:`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,fog_vertex:`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,fog_pars_vertex:`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,fog_fragment:`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,fog_pars_fragment:`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gradientmap_pars_fragment:`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,lightmap_pars_fragment:`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,lights_lambert_fragment:`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,lights_lambert_pars_fragment:`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,lights_pars_begin:`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif
#include <lightprobes_pars_fragment>`,lights_toon_fragment:`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,lights_toon_pars_fragment:`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,lights_phong_fragment:`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lights_phong_pars_fragment:`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,lights_physical_fragment:`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,lights_physical_pars_fragment:`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,lights_fragment_begin:`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = inverseTransformDirection( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,lights_fragment_maps:`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,lights_fragment_end:`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,lightprobes_pars_fragment:`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,logdepthbuf_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,logdepthbuf_pars_fragment:`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_pars_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,logdepthbuf_vertex:`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,map_fragment:`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,map_pars_fragment:`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,map_particle_fragment:`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,map_particle_pars_fragment:`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,metalnessmap_fragment:`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,metalnessmap_pars_fragment:`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,morphinstance_vertex:`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,morphcolor_vertex:`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,morphnormal_vertex:`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,morphtarget_pars_vertex:`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,morphtarget_vertex:`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,normal_fragment_begin:`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,normal_fragment_maps:`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,normal_pars_fragment:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_pars_vertex:`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,normal_vertex:`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,normalmap_pars_fragment:`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,clearcoat_normal_fragment_begin:`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,clearcoat_normal_fragment_maps:`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,clearcoat_pars_fragment:`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,iridescence_pars_fragment:`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,opaque_fragment:`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,packing:`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,premultiplied_alpha_fragment:`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,project_vertex:`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,dithering_fragment:`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,dithering_pars_fragment:`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,roughnessmap_fragment:`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,roughnessmap_pars_fragment:`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,shadowmap_pars_fragment:`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,shadowmap_pars_vertex:`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,shadowmap_vertex:`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,shadowmask_pars_fragment:`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,skinbase_vertex:`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,skinning_pars_vertex:`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,skinning_vertex:`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,skinnormal_vertex:`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,specularmap_fragment:`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,specularmap_pars_fragment:`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,tonemapping_fragment:`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,tonemapping_pars_fragment:`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,transmission_fragment:`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,transmission_pars_fragment:`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,uv_pars_fragment:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_pars_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,uv_vertex:`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,worldpos_vertex:`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,background_vert:`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,background_frag:`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,backgroundCube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,backgroundCube_frag:`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,cube_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,cube_frag:`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,depth_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,depth_frag:`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,distance_vert:`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,distance_frag:`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,equirect_vert:`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,equirect_frag:`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,linedashed_vert:`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,linedashed_frag:`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,meshbasic_vert:`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,meshbasic_frag:`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshlambert_vert:`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshlambert_frag:`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshmatcap_vert:`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,meshmatcap_frag:`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshnormal_vert:`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,meshnormal_frag:`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,meshphong_vert:`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshphong_frag:`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshphysical_vert:`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,meshphysical_frag:`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,meshtoon_vert:`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,meshtoon_frag:`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,points_vert:`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,points_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,shadow_vert:`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,shadow_frag:`uniform vec3 color;
uniform float opacity;
#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sprite_vert:`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,sprite_frag:`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`},Z={common:{diffuse:{value:new X(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Y},alphaMap:{value:null},alphaMapTransform:{value:new Y},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Y}},envmap:{envMap:{value:null},envMapRotation:{value:new Y},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Y}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Y}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Y},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Y},normalScale:{value:new q(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Y},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Y}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Y}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Y}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new X(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new J},probesMax:{value:new J},probesResolution:{value:new J}},points:{diffuse:{value:new X(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Y},alphaTest:{value:0},uvTransform:{value:new Y}},sprite:{diffuse:{value:new X(16777215)},opacity:{value:1},center:{value:new q(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Y},alphaMap:{value:null},alphaMapTransform:{value:new Y},alphaTest:{value:0}}},Md={basic:{uniforms:du([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.fog]),vertexShader:jd.meshbasic_vert,fragmentShader:jd.meshbasic_frag},lambert:{uniforms:du([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,Z.lights,{emissive:{value:new X(0)},envMapIntensity:{value:1}}]),vertexShader:jd.meshlambert_vert,fragmentShader:jd.meshlambert_frag},phong:{uniforms:du([Z.common,Z.specularmap,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,Z.lights,{emissive:{value:new X(0)},specular:{value:new X(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:jd.meshphong_vert,fragmentShader:jd.meshphong_frag},standard:{uniforms:du([Z.common,Z.envmap,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.roughnessmap,Z.metalnessmap,Z.fog,Z.lights,{emissive:{value:new X(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:jd.meshphysical_vert,fragmentShader:jd.meshphysical_frag},toon:{uniforms:du([Z.common,Z.aomap,Z.lightmap,Z.emissivemap,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.gradientmap,Z.fog,Z.lights,{emissive:{value:new X(0)}}]),vertexShader:jd.meshtoon_vert,fragmentShader:jd.meshtoon_frag},matcap:{uniforms:du([Z.common,Z.bumpmap,Z.normalmap,Z.displacementmap,Z.fog,{matcap:{value:null}}]),vertexShader:jd.meshmatcap_vert,fragmentShader:jd.meshmatcap_frag},points:{uniforms:du([Z.points,Z.fog]),vertexShader:jd.points_vert,fragmentShader:jd.points_frag},dashed:{uniforms:du([Z.common,Z.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:jd.linedashed_vert,fragmentShader:jd.linedashed_frag},depth:{uniforms:du([Z.common,Z.displacementmap]),vertexShader:jd.depth_vert,fragmentShader:jd.depth_frag},normal:{uniforms:du([Z.common,Z.bumpmap,Z.normalmap,Z.displacementmap,{opacity:{value:1}}]),vertexShader:jd.meshnormal_vert,fragmentShader:jd.meshnormal_frag},sprite:{uniforms:du([Z.sprite,Z.fog]),vertexShader:jd.sprite_vert,fragmentShader:jd.sprite_frag},background:{uniforms:{uvTransform:{value:new Y},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:jd.background_vert,fragmentShader:jd.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Y}},vertexShader:jd.backgroundCube_vert,fragmentShader:jd.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:jd.cube_vert,fragmentShader:jd.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:jd.equirect_vert,fragmentShader:jd.equirect_frag},distance:{uniforms:du([Z.common,Z.displacementmap,{referencePosition:{value:new J},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:jd.distance_vert,fragmentShader:jd.distance_frag},shadow:{uniforms:du([Z.lights,Z.fog,{color:{value:new X(0)},opacity:{value:1}}]),vertexShader:jd.shadow_vert,fragmentShader:jd.shadow_frag}};Md.physical={uniforms:du([Md.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Y},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Y},clearcoatNormalScale:{value:new q(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Y},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Y},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Y},sheen:{value:0},sheenColor:{value:new X(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Y},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Y},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Y},transmissionSamplerSize:{value:new q},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Y},attenuationDistance:{value:0},attenuationColor:{value:new X(0)},specularColor:{value:new X(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Y},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Y},anisotropyVector:{value:new q},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Y}}]),vertexShader:jd.meshphysical_vert,fragmentShader:jd.meshphysical_frag};var Nd={r:0,b:0,g:0},Pd=new js,Fd=new Y;Fd.set(-1,0,0,0,1,0,0,0,1);function Id(e,t,n,r,i,a){let o=new X(0),s=i===!0?0:1,c,l,u=null,d=0,f=null;function p(e){let n=e.isScene===!0?e.background:null;if(n&&n.isTexture){let r=e.backgroundBlurriness>0;n=t.get(n,r)}return n}function m(t){let r=!1,i=p(t);i===null?g(o,s):i&&i.isColor&&(g(i,1),r=!0);let c=e.xr.getEnvironmentBlendMode();c===`additive`?n.buffers.color.setClear(0,0,0,1,a):c===`alpha-blend`&&n.buffers.color.setClear(0,0,0,0,a),(e.autoClear||r)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function h(t,n){let i=p(n);i&&(i.isCubeTexture||i.mapping===306)?(l===void 0&&(l=new Al(new cu(1,1,1),new vu({name:`BackgroundCubeMaterial`,uniforms:uu(Md.backgroundCube.uniforms),vertexShader:Md.backgroundCube.vertexShader,fragmentShader:Md.backgroundCube.fragmentShader,side:1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute(`normal`),l.geometry.deleteAttribute(`uv`),l.onBeforeRender=function(e,t,n){this.matrixWorld.copyPosition(n.matrixWorld)},Object.defineProperty(l.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),r.update(l)),l.material.uniforms.envMap.value=i,l.material.uniforms.backgroundBlurriness.value=n.backgroundBlurriness,l.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,l.material.uniforms.backgroundRotation.value.setFromMatrix4(Pd.makeRotationFromEuler(n.backgroundRotation)).transpose(),i.isCubeTexture&&i.isRenderTargetTexture===!1&&l.material.uniforms.backgroundRotation.value.premultiply(Fd),l.material.toneMapped=hs.getTransfer(i.colorSpace)!==yo,(u!==i||d!==i.version||f!==e.toneMapping)&&(l.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),l.layers.enableAll(),t.unshift(l,l.geometry,l.material,0,0,null)):i&&i.isTexture&&(c===void 0&&(c=new Al(new lu(2,2),new vu({name:`BackgroundMaterial`,uniforms:uu(Md.background.uniforms),vertexShader:Md.background.vertexShader,fragmentShader:Md.background.fragmentShader,side:0,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute(`normal`),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),r.update(c)),c.material.uniforms.t2D.value=i,c.material.uniforms.backgroundIntensity.value=n.backgroundIntensity,c.material.toneMapped=hs.getTransfer(i.colorSpace)!==yo,i.matrixAutoUpdate===!0&&i.updateMatrix(),c.material.uniforms.uvTransform.value.copy(i.matrix),(u!==i||d!==i.version||f!==e.toneMapping)&&(c.material.needsUpdate=!0,u=i,d=i.version,f=e.toneMapping),c.layers.enableAll(),t.unshift(c,c.geometry,c.material,0,0,null))}function g(t,r){t.getRGB(Nd,mu(e)),n.buffers.color.setClear(Nd.r,Nd.g,Nd.b,r,a)}function _(){l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(e,t=1){o.set(e),s=t,g(o,s)},getClearAlpha:function(){return s},setClearAlpha:function(e){s=e,g(o,s)},render:m,addToRenderList:h,dispose:_}}function Ld(e,t){let n=e.getParameter(e.MAX_VERTEX_ATTRIBS),r={},i=f(null),a=i,o=!1;function s(n,r,i,s,c){let u=!1,f=d(n,s,i,r);a!==f&&(a=f,l(a.object)),u=p(n,s,i,c),u&&m(n,s,i,c),c!==null&&t.update(c,e.ELEMENT_ARRAY_BUFFER),(u||o)&&(o=!1,b(n,r,i,s),c!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,t.get(c).buffer))}function c(){return e.createVertexArray()}function l(t){return e.bindVertexArray(t)}function u(t){return e.deleteVertexArray(t)}function d(e,t,n,i){let a=i.wireframe===!0,o=r[t.id];o===void 0&&(o={},r[t.id]=o);let s=e.isInstancedMesh===!0?e.id:0,l=o[s];l===void 0&&(l={},o[s]=l);let u=l[n.id];u===void 0&&(u={},l[n.id]=u);let d=u[a];return d===void 0&&(d=f(c()),u[a]=d),d}function f(e){let t=[],r=[],i=[];for(let e=0;e<n;e++)t[e]=0,r[e]=0,i[e]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:t,enabledAttributes:r,attributeDivisors:i,object:e,attributes:{},index:null}}function p(e,t,n,r){let i=a.attributes,o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=i[t],r=o[t];if(r===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(r=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(r=e.instanceColor)),n===void 0||n.attribute!==r||r&&n.data!==r.data)return!0;s++}return a.attributesNum!==s||a.index!==r}function m(e,t,n,r){let i={},o=t.attributes,s=0,c=n.getAttributes();for(let t in c)if(c[t].location>=0){let n=o[t];n===void 0&&(t===`instanceMatrix`&&e.instanceMatrix&&(n=e.instanceMatrix),t===`instanceColor`&&e.instanceColor&&(n=e.instanceColor));let r={};r.attribute=n,n&&n.data&&(r.data=n.data),i[t]=r,s++}a.attributes=i,a.attributesNum=s,a.index=r}function h(){let e=a.newAttributes;for(let t=0,n=e.length;t<n;t++)e[t]=0}function g(e){_(e,0)}function _(t,n){let r=a.newAttributes,i=a.enabledAttributes,o=a.attributeDivisors;r[t]=1,i[t]===0&&(e.enableVertexAttribArray(t),i[t]=1),o[t]!==n&&(e.vertexAttribDivisor(t,n),o[t]=n)}function v(){let t=a.newAttributes,n=a.enabledAttributes;for(let r=0,i=n.length;r<i;r++)n[r]!==t[r]&&(e.disableVertexAttribArray(r),n[r]=0)}function y(t,n,r,i,a,o,s){s===!0?e.vertexAttribIPointer(t,n,r,a,o):e.vertexAttribPointer(t,n,r,i,a,o)}function b(n,r,i,a){h();let o=a.attributes,s=i.getAttributes(),c=r.defaultAttributeValues;for(let r in s){let i=s[r];if(i.location>=0){let s=o[r];if(s===void 0&&(r===`instanceMatrix`&&n.instanceMatrix&&(s=n.instanceMatrix),r===`instanceColor`&&n.instanceColor&&(s=n.instanceColor)),s!==void 0){let r=s.normalized,o=s.itemSize,c=t.get(s);if(c===void 0)continue;let l=c.buffer,u=c.type,d=c.bytesPerElement,f=u===e.INT||u===e.UNSIGNED_INT||s.gpuType===1013;if(s.isInterleavedBufferAttribute){let t=s.data,c=t.stride,p=s.offset;if(t.isInstancedInterleavedBuffer){for(let e=0;e<i.locationSize;e++)_(i.location+e,t.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=t.meshPerAttribute*t.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,c*d,(p+o/i.locationSize*e)*d,f)}else{if(s.isInstancedBufferAttribute){for(let e=0;e<i.locationSize;e++)_(i.location+e,s.meshPerAttribute);n.isInstancedMesh!==!0&&a._maxInstanceCount===void 0&&(a._maxInstanceCount=s.meshPerAttribute*s.count)}else for(let e=0;e<i.locationSize;e++)g(i.location+e);e.bindBuffer(e.ARRAY_BUFFER,l);for(let e=0;e<i.locationSize;e++)y(i.location+e,o/i.locationSize,u,r,o*d,o/i.locationSize*e*d,f)}}else if(c!==void 0){let t=c[r];if(t!==void 0)switch(t.length){case 2:e.vertexAttrib2fv(i.location,t);break;case 3:e.vertexAttrib3fv(i.location,t);break;case 4:e.vertexAttrib4fv(i.location,t);break;default:e.vertexAttrib1fv(i.location,t)}}}}v()}function x(){T();for(let e in r){let t=r[e];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e]}}function S(e){if(r[e.id]===void 0)return;let t=r[e.id];for(let e in t){let n=t[e];for(let e in n){let t=n[e];for(let e in t)u(t[e].object),delete t[e];delete n[e]}}delete r[e.id]}function C(e){for(let t in r){let n=r[t];for(let t in n){let r=n[t];if(r[e.id]===void 0)continue;let i=r[e.id];for(let e in i)u(i[e].object),delete i[e];delete r[e.id]}}}function w(e){for(let t in r){let n=r[t],i=e.isInstancedMesh===!0?e.id:0,a=n[i];if(a!==void 0){for(let e in a){let t=a[e];for(let e in t)u(t[e].object),delete t[e];delete a[e]}delete n[i],Object.keys(n).length===0&&delete r[t]}}}function T(){E(),o=!0,a!==i&&(a=i,l(a.object))}function E(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:s,reset:T,resetDefaultState:E,dispose:x,releaseStatesOfGeometry:S,releaseStatesOfObject:w,releaseStatesOfProgram:C,initAttributes:h,enableAttribute:g,disableUnusedAttributes:v}}function Rd(e,t,n){let r;function i(e){r=e}function a(t,i){e.drawArrays(r,t,i),n.update(i,r,1)}function o(t,i,a){a!==0&&(e.drawArraysInstanced(r,t,i,a),n.update(i,r,a))}function s(e,i,a){if(a===0)return;t.get(`WEBGL_multi_draw`).multiDrawArraysWEBGL(r,e,0,i,0,a);let o=0;for(let e=0;e<a;e++)o+=i[e];n.update(o,r,1)}this.setMode=i,this.render=a,this.renderInstances=o,this.renderMultiDraw=s}function zd(e,t,n,r){let i;function a(){if(i!==void 0)return i;if(t.has(`EXT_texture_filter_anisotropic`)===!0){let n=t.get(`EXT_texture_filter_anisotropic`);i=e.getParameter(n.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function o(t){return!(t!==1023&&r.convert(t)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function s(n){let i=n===1016&&(t.has(`EXT_color_buffer_half_float`)||t.has(`EXT_color_buffer_float`));return!(n!==1009&&r.convert(n)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE)&&n!==1015&&!i)}function c(t){if(t===`highp`){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return`highp`;t=`mediump`}return t===`mediump`&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?`mediump`:`lowp`}let l=n.precision===void 0?`highp`:n.precision,u=c(l);u!==l&&(G(`WebGLRenderer:`,l,`not supported, using`,u,`instead.`),l=u);let d=n.logarithmicDepthBuffer===!0,f=n.reversedDepthBuffer===!0&&t.has(`EXT_clip_control`);n.reversedDepthBuffer===!0&&f===!1&&G(`WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.`);let p=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),m=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),h=e.getParameter(e.MAX_TEXTURE_SIZE),g=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),_=e.getParameter(e.MAX_VERTEX_ATTRIBS),v=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),y=e.getParameter(e.MAX_VARYING_VECTORS),b=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),x=e.getParameter(e.MAX_SAMPLES),S=e.getParameter(e.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:c,textureFormatReadable:o,textureTypeReadable:s,precision:l,logarithmicDepthBuffer:d,reversedDepthBuffer:f,maxTextures:p,maxVertexTextures:m,maxTextureSize:h,maxCubemapSize:g,maxAttributes:_,maxVertexUniforms:v,maxVaryings:y,maxFragmentUniforms:b,maxSamples:x,samples:S}}function Bd(e){let t=this,n=null,r=0,i=!1,a=!1,o=new Kl,s=new Y,c={value:null,needsUpdate:!1};this.uniform=c,this.numPlanes=0,this.numIntersection=0,this.init=function(e,t){let n=e.length!==0||t||r!==0||i;return i=t,r=e.length,n},this.beginShadows=function(){a=!0,u(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(e,t){n=u(e,t,0)},this.setState=function(t,o,s){let d=t.clippingPlanes,f=t.clipIntersection,p=t.clipShadows,m=e.get(t);if(!i||d===null||d.length===0||a&&!p)a?u(null):l();else{let e=a?0:r,t=e*4,i=m.clippingState||null;c.value=i,i=u(d,o,t,s);for(let e=0;e!==t;++e)i[e]=n[e];m.clippingState=i,this.numIntersection=f?this.numPlanes:0,this.numPlanes+=e}};function l(){c.value!==n&&(c.value=n,c.needsUpdate=r>0),t.numPlanes=r,t.numIntersection=0}function u(e,n,r,i){let a=e===null?0:e.length,l=null;if(a!==0){if(l=c.value,i!==!0||l===null){let t=r+a*4,i=n.matrixWorldInverse;s.getNormalMatrix(i),(l===null||l.length<t)&&(l=new Float32Array(t));for(let t=0,n=r;t!==a;++t,n+=4)o.copy(e[t]).applyMatrix4(i,s),o.normal.toArray(l,n),l[n+3]=o.constant}c.value=l,c.needsUpdate=!0}return t.numPlanes=a,t.numIntersection=0,l}}var Vd=4,Hd=[.125,.215,.35,.446,.526,.582],Ud=20,Wd=256,Gd=new td,Kd=new X,qd=null,Jd=0,Yd=0,Xd=!1,Zd=new J,Qd=class{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,r=100,i={}){let{size:a=256,position:o=Zd}=i;qd=this._renderer.getRenderTarget(),Jd=this._renderer.getActiveCubeFace(),Yd=this._renderer.getActiveMipmapLevel(),Xd=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);let s=this._allocateTargets();return s.depthBuffer=!0,this._sceneToCubeUV(e,n,r,s,o),t>0&&this._blur(s,0,0,t),this._applyPMREM(s),this._cleanup(s),s}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=of(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=af(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=2**this._lodMax}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(qd,Jd,Yd),this._renderer.xr.enabled=Xd,e.scissorTest=!1,tf(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===301||e.mapping===302?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),qd=this._renderer.getRenderTarget(),Jd=this._renderer.getActiveCubeFace(),Yd=this._renderer.getActiveMipmapLevel(),Xd=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){let e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:$i,minFilter:$i,generateMipmaps:!1,type:la,format:_a,colorSpace:_o,depthBuffer:!1},r=ef(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=ef(e,t,n);let{_lodMax:r}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=$d(r)),this._blurMaterial=rf(r,e,t),this._ggxMaterial=nf(r,e,t)}return r}_compileMaterial(e){let t=new Al(new sl,e);this._renderer.compile(t,Gd)}_sceneToCubeUV(e,t,n,r,i){let a=new Qu(90,1,t,n),o=[1,-1,1,1,1,1],s=[1,1,1,-1,-1,-1],c=this._renderer,l=c.autoClear,u=c.toneMapping;c.getClearColor(Kd),c.toneMapping=0,c.autoClear=!1,c.state.buffers.depth.getReversed()&&(c.setRenderTarget(r),c.clearDepth(),c.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Al(new cu,new vl({name:`PMREM.Background`,side:1,depthWrite:!1,depthTest:!1})));let d=this._backgroundBox,f=d.material,p=!1,m=e.background;m?m.isColor&&(f.color.copy(m),e.background=null,p=!0):(f.color.copy(Kd),p=!0);for(let t=0;t<6;t++){let n=t%3;n===0?(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x+s[t],i.y,i.z)):n===1?(a.up.set(0,0,o[t]),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y+s[t],i.z)):(a.up.set(0,o[t],0),a.position.set(i.x,i.y,i.z),a.lookAt(i.x,i.y,i.z+s[t]));let l=this._cubeSize;tf(r,n*l,t>2?l:0,l,l),c.setRenderTarget(r),p&&c.render(d,a),c.render(e,a)}c.toneMapping=u,c.autoClear=l,e.background=m}_textureToCubeUV(e,t){let n=this._renderer,r=e.mapping===301||e.mapping===302;r?(this._cubemapMaterial===null&&(this._cubemapMaterial=of()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=af());let i=r?this._cubemapMaterial:this._equirectMaterial,a=this._lodMeshes[0];a.material=i;let o=i.uniforms;o.envMap.value=e;let s=this._cubeSize;tf(t,0,0,3*s,2*s),n.setRenderTarget(t),n.render(a,Gd)}_applyPMREM(e){let t=this._renderer,n=t.autoClear;t.autoClear=!1;let r=this._lodMeshes.length;for(let t=1;t<r;t++)this._applyGGXFilter(e,t-1,t);t.autoClear=n}_applyGGXFilter(e,t,n){let r=this._renderer,i=this._pingPongRenderTarget,a=this._ggxMaterial,o=this._lodMeshes[n];o.material=a;let s=a.uniforms,c=n/(this._lodMeshes.length-1),l=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-l*l)*(0+c*1.25),{_lodMax:d}=this,f=this._sizeLods[n],p=3*f*(n>d-Vd?n-d+Vd:0),m=4*(this._cubeSize-f);s.envMap.value=e.texture,s.roughness.value=u,s.mipInt.value=d-t,tf(i,p,m,3*f,2*f),r.setRenderTarget(i),r.render(o,Gd),s.envMap.value=i.texture,s.roughness.value=0,s.mipInt.value=d-n,tf(e,p,m,3*f,2*f),r.setRenderTarget(e),r.render(o,Gd)}_blur(e,t,n,r,i){let a=this._pingPongRenderTarget;this._halfBlur(e,a,t,n,r,`latitudinal`,i),this._halfBlur(a,e,n,n,r,`longitudinal`,i)}_halfBlur(e,t,n,r,i,a,o){let s=this._renderer,c=this._blurMaterial;a!==`latitudinal`&&a!==`longitudinal`&&K(`blur direction must be either latitudinal or longitudinal!`);let l=this._lodMeshes[r];l.material=c;let u=c.uniforms,d=this._sizeLods[n]-1,f=isFinite(i)?Math.PI/(2*d):2*Math.PI/(2*Ud-1),p=i/f,m=isFinite(i)?1+Math.floor(3*p):Ud;m>Ud&&G(`sigmaRadians, ${i}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${Ud}`);let h=[],g=0;for(let e=0;e<Ud;++e){let t=e/p,n=Math.exp(-t*t/2);h.push(n),e===0?g+=n:e<m&&(g+=2*n)}for(let e=0;e<h.length;e++)h[e]=h[e]/g;u.envMap.value=e.texture,u.samples.value=m,u.weights.value=h,u.latitudinal.value=a===`latitudinal`,o&&(u.poleAxis.value=o);let{_lodMax:_}=this;u.dTheta.value=f,u.mipInt.value=_-n;let v=this._sizeLods[r];tf(t,3*v*(r>_-Vd?r-_+Vd:0),4*(this._cubeSize-v),3*v,2*v),s.setRenderTarget(t),s.render(l,Gd)}};function $d(e){let t=[],n=[],r=[],i=e,a=e-Vd+1+Hd.length;for(let o=0;o<a;o++){let a=2**i;t.push(a);let s=1/a;o>e-Vd?s=Hd[o-e+Vd-1]:o===0&&(s=0),n.push(s);let c=1/(a-2),l=-c,u=1+c,d=[l,l,u,l,u,u,l,l,u,u,l,u],f=new Float32Array(108),p=new Float32Array(72),m=new Float32Array(36);for(let e=0;e<6;e++){let t=e%3*2/3-1,n=e>2?0:-1,r=[t,n,0,t+2/3,n,0,t+2/3,n+1,0,t,n,0,t+2/3,n+1,0,t,n+1,0];f.set(r,18*e),p.set(d,12*e);let i=[e,e,e,e,e,e];m.set(i,6*e)}let h=new sl;h.setAttribute(`position`,new Kc(f,3)),h.setAttribute(`uv`,new Kc(p,2)),h.setAttribute(`faceIndex`,new Kc(m,1)),r.push(new Al(h,null)),i>Vd&&i--}return{lodMeshes:r,sizeLods:t,sigmas:n}}function ef(e,t,n){let r=new Os(e,t,n);return r.texture.mapping=306,r.texture.name=`PMREM.cubeUv`,r.scissorTest=!0,r}function tf(e,t,n,r,i){e.viewport.set(t,n,r,i),e.scissor.set(t,n,r,i)}function nf(e,t,n){return new vu({name:`PMREMGGXConvolution`,defines:{GGX_SAMPLES:Wd,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:sf(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function rf(e,t,n){let r=new Float32Array(Ud),i=new J(0,1,0);return new vu({name:`SphericalGaussianBlur`,defines:{n:Ud,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/n,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:r},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:sf(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function af(){return new vu({name:`EquirectangularToCubeUV`,uniforms:{envMap:{value:null}},vertexShader:sf(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function of(){return new vu({name:`CubemapToCubeUV`,uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:sf(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:0,depthTest:!1,depthWrite:!1})}function sf(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}var cf=class extends Os{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;let n={width:e,height:e,depth:1},r=[n,n,n,n,n,n];this.texture=new iu(r),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;let n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},r=new cu(5,5,5),i=new vu({name:`CubemapFromEquirect`,uniforms:uu(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:1,blending:0});i.uniforms.tEquirect.value=t;let a=new Al(r,i),o=t.minFilter;return t.minFilter===1008&&(t.minFilter=$i),new sd(1,10,this).update(e,a),t.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(e,t=!0,n=!0,r=!0){let i=e.getRenderTarget();for(let i=0;i<6;i++)e.setRenderTarget(this,i),e.clear(t,n,r);e.setRenderTarget(i)}};function lf(e){let t=new WeakMap,n=new WeakMap,r=null;function i(e,t=!1){return e==null?null:t?o(e):a(e)}function a(n){if(n&&n.isTexture){let r=n.mapping;if(r===303||r===304)if(t.has(n)){let e=t.get(n).texture;return s(e,n.mapping)}else{let r=n.image;if(r&&r.height>0){let i=new cf(r.height);return i.fromEquirectangularTexture(e,n),t.set(n,i),n.addEventListener(`dispose`,l),s(i.texture,n.mapping)}else return null}}return n}function o(t){if(t&&t.isTexture){let i=t.mapping,a=i===303||i===304,o=i===301||i===302;if(a||o){let i=n.get(t),s=i===void 0?0:i.texture.pmremVersion;if(t.isRenderTargetTexture&&t.pmremVersion!==s)return r===null&&(r=new Qd(e)),i=a?r.fromEquirectangular(t,i):r.fromCubemap(t,i),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),i.texture;if(i!==void 0)return i.texture;{let s=t.image;return a&&s&&s.height>0||o&&s&&c(s)?(r===null&&(r=new Qd(e)),i=a?r.fromEquirectangular(t):r.fromCubemap(t),i.texture.pmremVersion=t.pmremVersion,n.set(t,i),t.addEventListener(`dispose`,u),i.texture):null}}}return t}function s(e,t){return t===303?e.mapping=301:t===304&&(e.mapping=302),e}function c(e){let t=0;for(let n=0;n<6;n++)e[n]!==void 0&&t++;return t===6}function l(e){let n=e.target;n.removeEventListener(`dispose`,l);let r=t.get(n);r!==void 0&&(t.delete(n),r.dispose())}function u(e){let t=e.target;t.removeEventListener(`dispose`,u);let r=n.get(t);r!==void 0&&(n.delete(t),r.dispose())}function d(){t=new WeakMap,n=new WeakMap,r!==null&&(r.dispose(),r=null)}return{get:i,dispose:d}}function uf(e){let t={};function n(n){if(t[n]!==void 0)return t[n];let r=e.getExtension(n);return t[n]=r,r}return{has:function(e){return n(e)!==null},init:function(){n(`EXT_color_buffer_float`),n(`WEBGL_clip_cull_distance`),n(`OES_texture_float_linear`),n(`EXT_color_buffer_half_float`),n(`WEBGL_multisampled_render_to_texture`),n(`WEBGL_render_shared_exponent`)},get:function(e){let t=n(e);return t===null&&jo(`WebGLRenderer: `+e+` extension not supported.`),t}}}function df(e,t,n,r){let i={},a=new WeakMap;function o(e){let s=e.target;s.index!==null&&t.remove(s.index);for(let e in s.attributes)t.remove(s.attributes[e]);s.removeEventListener(`dispose`,o),delete i[s.id];let c=a.get(s);c&&(t.remove(c),a.delete(s)),r.releaseStatesOfGeometry(s),s.isInstancedBufferGeometry===!0&&delete s._maxInstanceCount,n.memory.geometries--}function s(e,t){return i[t.id]===!0?t:(t.addEventListener(`dispose`,o),i[t.id]=!0,n.memory.geometries++,t)}function c(n){let r=n.attributes;for(let n in r)t.update(r[n],e.ARRAY_BUFFER)}function l(e){let n=[],r=e.index,i=e.attributes.position,o=0;if(i===void 0)return;if(r!==null){let e=r.array;o=r.version;for(let t=0,r=e.length;t<r;t+=3){let r=e[t+0],i=e[t+1],a=e[t+2];n.push(r,i,i,a,a,r)}}else{let e=i.array;o=i.version;for(let t=0,r=e.length/3-1;t<r;t+=3){let e=t+0,r=t+1,i=t+2;n.push(e,r,r,i,i,e)}}let s=new(i.count>=65535?Jc:qc)(n,1);s.version=o;let c=a.get(e);c&&t.remove(c),a.set(e,s)}function u(e){let t=a.get(e);if(t){let n=e.index;n!==null&&t.version<n.version&&l(e)}else l(e);return a.get(e)}return{get:s,update:c,getWireframeAttribute:u}}function ff(e,t,n){let r;function i(e){r=e}let a,o;function s(e){a=e.type,o=e.bytesPerElement}function c(t,i){e.drawElements(r,i,a,t*o),n.update(i,r,1)}function l(t,i,s){s!==0&&(e.drawElementsInstanced(r,i,a,t*o,s),n.update(i,r,s))}function u(e,i,o){if(o===0)return;t.get(`WEBGL_multi_draw`).multiDrawElementsWEBGL(r,i,0,a,e,0,o);let s=0;for(let e=0;e<o;e++)s+=i[e];n.update(s,r,1)}this.setMode=i,this.setIndex=s,this.render=c,this.renderInstances=l,this.renderMultiDraw=u}function pf(e){let t={geometries:0,textures:0},n={frame:0,calls:0,triangles:0,points:0,lines:0};function r(t,r,i){switch(n.calls++,r){case e.TRIANGLES:n.triangles+=t/3*i;break;case e.LINES:n.lines+=t/2*i;break;case e.LINE_STRIP:n.lines+=i*(t-1);break;case e.LINE_LOOP:n.lines+=i*t;break;case e.POINTS:n.points+=i*t;break;default:K(`WebGLInfo: Unknown draw mode:`,r);break}}function i(){n.calls=0,n.triangles=0,n.points=0,n.lines=0}return{memory:t,render:n,programs:null,autoReset:!0,reset:i,update:r}}function mf(e,t,n){let r=new WeakMap,i=new Es;function a(a,o,s){let c=a.morphTargetInfluences,l=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=l===void 0?0:l.length,d=r.get(o);if(d===void 0||d.count!==u){d!==void 0&&d.texture.dispose();let e=o.morphAttributes.position!==void 0,n=o.morphAttributes.normal!==void 0,a=o.morphAttributes.color!==void 0,s=o.morphAttributes.position||[],c=o.morphAttributes.normal||[],l=o.morphAttributes.color||[],f=0;e===!0&&(f=1),n===!0&&(f=2),a===!0&&(f=3);let p=o.attributes.position.count*f,m=1;p>t.maxTextureSize&&(m=Math.ceil(p/t.maxTextureSize),p=t.maxTextureSize);let h=new Float32Array(p*m*4*u),g=new ks(h,p,m,u);g.type=ca,g.needsUpdate=!0;let _=f*4;for(let t=0;t<u;t++){let r=s[t],o=c[t],u=l[t],d=p*m*4*t;for(let t=0;t<r.count;t++){let s=t*_;e===!0&&(i.fromBufferAttribute(r,t),h[d+s+0]=i.x,h[d+s+1]=i.y,h[d+s+2]=i.z,h[d+s+3]=0),n===!0&&(i.fromBufferAttribute(o,t),h[d+s+4]=i.x,h[d+s+5]=i.y,h[d+s+6]=i.z,h[d+s+7]=0),a===!0&&(i.fromBufferAttribute(u,t),h[d+s+8]=i.x,h[d+s+9]=i.y,h[d+s+10]=i.z,h[d+s+11]=u.itemSize===4?i.w:1)}}d={count:u,texture:g,size:new q(p,m)},r.set(o,d);function v(){g.dispose(),r.delete(o),o.removeEventListener(`dispose`,v)}o.addEventListener(`dispose`,v)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)s.getUniforms().setValue(e,`morphTexture`,a.morphTexture,n);else{let t=0;for(let e=0;e<c.length;e++)t+=c[e];let n=o.morphTargetsRelative?1:1-t;s.getUniforms().setValue(e,`morphTargetBaseInfluence`,n),s.getUniforms().setValue(e,`morphTargetInfluences`,c)}s.getUniforms().setValue(e,`morphTargetsTexture`,d.texture,n),s.getUniforms().setValue(e,`morphTargetsTextureSize`,d.size)}return{update:a}}function hf(e,t,n,r,i){let a=new WeakMap;function o(r){let o=i.render.frame,s=r.geometry,l=t.get(r,s);if(a.get(l)!==o&&(t.update(l),a.set(l,o)),r.isInstancedMesh&&(r.hasEventListener(`dispose`,c)===!1&&r.addEventListener(`dispose`,c),a.get(r)!==o&&(n.update(r.instanceMatrix,e.ARRAY_BUFFER),r.instanceColor!==null&&n.update(r.instanceColor,e.ARRAY_BUFFER),a.set(r,o))),r.isSkinnedMesh){let e=r.skeleton;a.get(e)!==o&&(e.update(),a.set(e,o))}return l}function s(){a=new WeakMap}function c(e){let t=e.target;t.removeEventListener(`dispose`,c),r.releaseStatesOfObject(t),n.remove(t.instanceMatrix),t.instanceColor!==null&&n.remove(t.instanceColor)}return{update:o,dispose:s}}var gf={1:`LINEAR_TONE_MAPPING`,2:`REINHARD_TONE_MAPPING`,3:`CINEON_TONE_MAPPING`,4:`ACES_FILMIC_TONE_MAPPING`,6:`AGX_TONE_MAPPING`,7:`NEUTRAL_TONE_MAPPING`,5:`CUSTOM_TONE_MAPPING`};function _f(e,t,n,r,i){let a=new Os(t,n,{type:e,depthBuffer:r,stencilBuffer:i,depthTexture:r?new au(t,n):void 0}),o=new Os(t,n,{type:la,depthBuffer:!1,stencilBuffer:!1}),s=new sl;s.setAttribute(`position`,new Yc([-1,3,0,-1,-1,0,3,-1,0],3)),s.setAttribute(`uv`,new Yc([0,2,0,0,2,0],2));let c=new yu({uniforms:{tDiffuse:{value:null}},vertexShader:`
			precision highp float;

			uniform mat4 modelViewMatrix;
			uniform mat4 projectionMatrix;

			attribute vec3 position;
			attribute vec2 uv;

			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,fragmentShader:`
			precision highp float;

			uniform sampler2D tDiffuse;

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

				#ifdef LINEAR_TONE_MAPPING
					gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
				#elif defined( REINHARD_TONE_MAPPING )
					gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
				#elif defined( CINEON_TONE_MAPPING )
					gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
				#elif defined( ACES_FILMIC_TONE_MAPPING )
					gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
				#elif defined( AGX_TONE_MAPPING )
					gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
				#elif defined( NEUTRAL_TONE_MAPPING )
					gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
				#elif defined( CUSTOM_TONE_MAPPING )
					gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
				#endif

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),l=new Al(s,c),u=new td(-1,1,1,-1,0,1),d=null,f=null,p=!1,m,h=null,g=[],_=!1;this.setSize=function(e,t){a.setSize(e,t),o.setSize(e,t);for(let n=0;n<g.length;n++){let r=g[n];r.setSize&&r.setSize(e,t)}},this.setEffects=function(e){g=e,_=g.length>0&&g[0].isRenderPass===!0;let t=a.width,n=a.height;for(let e=0;e<g.length;e++){let r=g[e];r.setSize&&r.setSize(t,n)}},this.begin=function(e,t){if(p||e.toneMapping===0&&g.length===0)return!1;if(h=t,t!==null){let e=t.width,n=t.height;(a.width!==e||a.height!==n)&&this.setSize(e,n)}return _===!1&&e.setRenderTarget(a),m=e.toneMapping,e.toneMapping=0,!0},this.hasRenderPass=function(){return _},this.end=function(e,t){e.toneMapping=m,p=!0;let n=a,r=o;for(let i=0;i<g.length;i++){let a=g[i];if(a.enabled!==!1&&(a.render(e,r,n,t),a.needsSwap!==!1)){let e=n;n=r,r=e}}if(d!==e.outputColorSpace||f!==e.toneMapping){d=e.outputColorSpace,f=e.toneMapping,c.defines={},hs.getTransfer(d)===`srgb`&&(c.defines.SRGB_TRANSFER=``);let t=gf[f];t&&(c.defines[t]=``),c.needsUpdate=!0}c.uniforms.tDiffuse.value=n.texture,e.setRenderTarget(h),e.render(l,u),h=null,p=!1},this.isCompositing=function(){return p},this.dispose=function(){a.depthTexture&&a.depthTexture.dispose(),a.dispose(),o.dispose(),s.dispose(),c.dispose()}}var vf=new Ts,yf=new au(1,1),bf=new ks,xf=new As,Sf=new iu,Cf=[],wf=[],Tf=new Float32Array(16),Ef=new Float32Array(9),Df=new Float32Array(4);function Of(e,t,n){let r=e[0];if(r<=0||r>0)return e;let i=t*n,a=Cf[i];if(a===void 0&&(a=new Float32Array(i),Cf[i]=a),t!==0){r.toArray(a,0);for(let r=1,i=0;r!==t;++r)i+=n,e[r].toArray(a,i)}return a}function kf(e,t){if(e.length!==t.length)return!1;for(let n=0,r=e.length;n<r;n++)if(e[n]!==t[n])return!1;return!0}function Af(e,t){for(let n=0,r=t.length;n<r;n++)e[n]=t[n]}function jf(e,t){let n=wf[t];n===void 0&&(n=new Int32Array(t),wf[t]=n);for(let r=0;r!==t;++r)n[r]=e.allocateTextureUnit();return n}function Mf(e,t){let n=this.cache;n[0]!==t&&(e.uniform1f(this.addr,t),n[0]=t)}function Nf(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2f(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(kf(n,t))return;e.uniform2fv(this.addr,t),Af(n,t)}}function Pf(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3f(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else if(t.r!==void 0)(n[0]!==t.r||n[1]!==t.g||n[2]!==t.b)&&(e.uniform3f(this.addr,t.r,t.g,t.b),n[0]=t.r,n[1]=t.g,n[2]=t.b);else{if(kf(n,t))return;e.uniform3fv(this.addr,t),Af(n,t)}}function Ff(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4f(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(kf(n,t))return;e.uniform4fv(this.addr,t),Af(n,t)}}function If(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(kf(n,t))return;e.uniformMatrix2fv(this.addr,!1,t),Af(n,t)}else{if(kf(n,r))return;Df.set(r),e.uniformMatrix2fv(this.addr,!1,Df),Af(n,r)}}function Lf(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(kf(n,t))return;e.uniformMatrix3fv(this.addr,!1,t),Af(n,t)}else{if(kf(n,r))return;Ef.set(r),e.uniformMatrix3fv(this.addr,!1,Ef),Af(n,r)}}function Rf(e,t){let n=this.cache,r=t.elements;if(r===void 0){if(kf(n,t))return;e.uniformMatrix4fv(this.addr,!1,t),Af(n,t)}else{if(kf(n,r))return;Tf.set(r),e.uniformMatrix4fv(this.addr,!1,Tf),Af(n,r)}}function zf(e,t){let n=this.cache;n[0]!==t&&(e.uniform1i(this.addr,t),n[0]=t)}function Bf(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2i(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(kf(n,t))return;e.uniform2iv(this.addr,t),Af(n,t)}}function Vf(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3i(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(kf(n,t))return;e.uniform3iv(this.addr,t),Af(n,t)}}function Hf(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4i(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(kf(n,t))return;e.uniform4iv(this.addr,t),Af(n,t)}}function Uf(e,t){let n=this.cache;n[0]!==t&&(e.uniform1ui(this.addr,t),n[0]=t)}function Wf(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y)&&(e.uniform2ui(this.addr,t.x,t.y),n[0]=t.x,n[1]=t.y);else{if(kf(n,t))return;e.uniform2uiv(this.addr,t),Af(n,t)}}function Gf(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z)&&(e.uniform3ui(this.addr,t.x,t.y,t.z),n[0]=t.x,n[1]=t.y,n[2]=t.z);else{if(kf(n,t))return;e.uniform3uiv(this.addr,t),Af(n,t)}}function Kf(e,t){let n=this.cache;if(t.x!==void 0)(n[0]!==t.x||n[1]!==t.y||n[2]!==t.z||n[3]!==t.w)&&(e.uniform4ui(this.addr,t.x,t.y,t.z,t.w),n[0]=t.x,n[1]=t.y,n[2]=t.z,n[3]=t.w);else{if(kf(n,t))return;e.uniform4uiv(this.addr,t),Af(n,t)}}function qf(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i);let a;this.type===e.SAMPLER_2D_SHADOW?(yf.compareFunction=n.isReversedDepthBuffer()?518:515,a=yf):a=vf,n.setTexture2D(t||a,i)}function Jf(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture3D(t||xf,i)}function Yf(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTextureCube(t||Sf,i)}function Xf(e,t,n){let r=this.cache,i=n.allocateTextureUnit();r[0]!==i&&(e.uniform1i(this.addr,i),r[0]=i),n.setTexture2DArray(t||bf,i)}function Zf(e){switch(e){case 5126:return Mf;case 35664:return Nf;case 35665:return Pf;case 35666:return Ff;case 35674:return If;case 35675:return Lf;case 35676:return Rf;case 5124:case 35670:return zf;case 35667:case 35671:return Bf;case 35668:case 35672:return Vf;case 35669:case 35673:return Hf;case 5125:return Uf;case 36294:return Wf;case 36295:return Gf;case 36296:return Kf;case 35678:case 36198:case 36298:case 36306:case 35682:return qf;case 35679:case 36299:case 36307:return Jf;case 35680:case 36300:case 36308:case 36293:return Yf;case 36289:case 36303:case 36311:case 36292:return Xf}}function Qf(e,t){e.uniform1fv(this.addr,t)}function $f(e,t){let n=Of(t,this.size,2);e.uniform2fv(this.addr,n)}function ep(e,t){let n=Of(t,this.size,3);e.uniform3fv(this.addr,n)}function tp(e,t){let n=Of(t,this.size,4);e.uniform4fv(this.addr,n)}function np(e,t){let n=Of(t,this.size,4);e.uniformMatrix2fv(this.addr,!1,n)}function rp(e,t){let n=Of(t,this.size,9);e.uniformMatrix3fv(this.addr,!1,n)}function ip(e,t){let n=Of(t,this.size,16);e.uniformMatrix4fv(this.addr,!1,n)}function ap(e,t){e.uniform1iv(this.addr,t)}function op(e,t){e.uniform2iv(this.addr,t)}function sp(e,t){e.uniform3iv(this.addr,t)}function cp(e,t){e.uniform4iv(this.addr,t)}function lp(e,t){e.uniform1uiv(this.addr,t)}function up(e,t){e.uniform2uiv(this.addr,t)}function dp(e,t){e.uniform3uiv(this.addr,t)}function fp(e,t){e.uniform4uiv(this.addr,t)}function pp(e,t,n){let r=this.cache,i=t.length,a=jf(n,i);kf(r,a)||(e.uniform1iv(this.addr,a),Af(r,a));let o;o=this.type===e.SAMPLER_2D_SHADOW?yf:vf;for(let e=0;e!==i;++e)n.setTexture2D(t[e]||o,a[e])}function mp(e,t,n){let r=this.cache,i=t.length,a=jf(n,i);kf(r,a)||(e.uniform1iv(this.addr,a),Af(r,a));for(let e=0;e!==i;++e)n.setTexture3D(t[e]||xf,a[e])}function hp(e,t,n){let r=this.cache,i=t.length,a=jf(n,i);kf(r,a)||(e.uniform1iv(this.addr,a),Af(r,a));for(let e=0;e!==i;++e)n.setTextureCube(t[e]||Sf,a[e])}function gp(e,t,n){let r=this.cache,i=t.length,a=jf(n,i);kf(r,a)||(e.uniform1iv(this.addr,a),Af(r,a));for(let e=0;e!==i;++e)n.setTexture2DArray(t[e]||bf,a[e])}function _p(e){switch(e){case 5126:return Qf;case 35664:return $f;case 35665:return ep;case 35666:return tp;case 35674:return np;case 35675:return rp;case 35676:return ip;case 5124:case 35670:return ap;case 35667:case 35671:return op;case 35668:case 35672:return sp;case 35669:case 35673:return cp;case 5125:return lp;case 36294:return up;case 36295:return dp;case 36296:return fp;case 35678:case 36198:case 36298:case 36306:case 35682:return pp;case 35679:case 36299:case 36307:return mp;case 35680:case 36300:case 36308:case 36293:return hp;case 36289:case 36303:case 36311:case 36292:return gp}}var vp=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Zf(t.type)}},yp=class{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=_p(t.type)}},bp=class{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){let r=this.seq;for(let i=0,a=r.length;i!==a;++i){let a=r[i];a.setValue(e,t[a.id],n)}}},xp=/(\w+)(\])?(\[|\.)?/g;function Sp(e,t){e.seq.push(t),e.map[t.id]=t}function Cp(e,t,n){let r=e.name,i=r.length;for(xp.lastIndex=0;;){let a=xp.exec(r),o=xp.lastIndex,s=a[1],c=a[2]===`]`,l=a[3];if(c&&(s|=0),l===void 0||l===`[`&&o+2===i){Sp(n,l===void 0?new vp(s,e,t):new yp(s,e,t));break}else{let e=n.map[s];e===void 0&&(e=new bp(s),Sp(n,e)),n=e}}}var wp=class{constructor(e,t){this.seq=[],this.map={};let n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){let n=e.getActiveUniform(t,r);Cp(n,e.getUniformLocation(t,n.name),this)}let r=[],i=[];for(let t of this.seq)t.type===e.SAMPLER_2D_SHADOW||t.type===e.SAMPLER_CUBE_SHADOW||t.type===e.SAMPLER_2D_ARRAY_SHADOW?r.push(t):i.push(t);r.length>0&&(this.seq=r.concat(i))}setValue(e,t,n,r){let i=this.map[t];i!==void 0&&i.setValue(e,n,r)}setOptional(e,t,n){let r=t[n];r!==void 0&&this.setValue(e,n,r)}static upload(e,t,n,r){for(let i=0,a=t.length;i!==a;++i){let a=t[i],o=n[a.id];o.needsUpdate!==!1&&a.setValue(e,o.value,r)}}static seqWithValue(e,t){let n=[];for(let r=0,i=e.length;r!==i;++r){let i=e[r];i.id in t&&n.push(i)}return n}};function Tp(e,t,n){let r=e.createShader(t);return e.shaderSource(r,n),e.compileShader(r),r}var Ep=37297,Dp=0;function Op(e,t){let n=e.split(`
`),r=[],i=Math.max(t-6,0),a=Math.min(t+6,n.length);for(let e=i;e<a;e++){let i=e+1;r.push(`${i===t?`>`:` `} ${i}: ${n[e]}`)}return r.join(`
`)}var kp=new Y;function Ap(e){hs._getMatrix(kp,hs.workingColorSpace,e);let t=`mat3( ${kp.elements.map(e=>e.toFixed(4))} )`;switch(hs.getTransfer(e)){case vo:return[t,`LinearTransferOETF`];case yo:return[t,`sRGBTransferOETF`];default:return G(`WebGLProgram: Unsupported color space: `,e),[t,`LinearTransferOETF`]}}function jp(e,t,n){let r=e.getShaderParameter(t,e.COMPILE_STATUS),i=(e.getShaderInfoLog(t)||``).trim();if(r&&i===``)return``;let a=/ERROR: 0:(\d+)/.exec(i);if(a){let r=parseInt(a[1]);return n.toUpperCase()+`

`+i+`

`+Op(e.getShaderSource(t),r)}else return i}function Mp(e,t){let n=Ap(t);return[`vec4 ${e}( vec4 value ) {`,`	return ${n[1]}( vec4( value.rgb * ${n[0]}, value.a ) );`,`}`].join(`
`)}var Np={1:`Linear`,2:`Reinhard`,3:`Cineon`,4:`ACESFilmic`,6:`AgX`,7:`Neutral`,5:`Custom`};function Pp(e,t){let n=Np[t];return n===void 0?(G(`WebGLProgram: Unsupported toneMapping:`,t),`vec3 `+e+`( vec3 color ) { return LinearToneMapping( color ); }`):`vec3 `+e+`( vec3 color ) { return `+n+`ToneMapping( color ); }`}var Fp=new J;function Ip(){return hs.getLuminanceCoefficients(Fp),[`float luminance( const in vec3 rgb ) {`,`	const vec3 weights = vec3( ${Fp.x.toFixed(4)}, ${Fp.y.toFixed(4)}, ${Fp.z.toFixed(4)} );`,`	return dot( weights, rgb );`,`}`].join(`
`)}function Lp(e){return[e.extensionClipCullDistance?`#extension GL_ANGLE_clip_cull_distance : require`:``,e.extensionMultiDraw?`#extension GL_ANGLE_multi_draw : require`:``].filter(Bp).join(`
`)}function Rp(e){let t=[];for(let n in e){let r=e[n];r!==!1&&t.push(`#define `+n+` `+r)}return t.join(`
`)}function zp(e,t){let n={},r=e.getProgramParameter(t,e.ACTIVE_ATTRIBUTES);for(let i=0;i<r;i++){let r=e.getActiveAttrib(t,i),a=r.name,o=1;r.type===e.FLOAT_MAT2&&(o=2),r.type===e.FLOAT_MAT3&&(o=3),r.type===e.FLOAT_MAT4&&(o=4),n[a]={type:r.type,location:e.getAttribLocation(t,a),locationSize:o}}return n}function Bp(e){return e!==``}function Vp(e,t){let n=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return e.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,n).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function Hp(e,t){return e.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}var Up=/^[ \t]*#include +<([\w\d./]+)>/gm;function Wp(e){return e.replace(Up,Kp)}var Gp=new Map;function Kp(e,t){let n=jd[t];if(n===void 0){let e=Gp.get(t);if(e!==void 0)n=jd[e],G(`WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.`,t,e);else throw Error(`Can not resolve #include <`+t+`>`)}return Wp(n)}var qp=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Jp(e){return e.replace(qp,Yp)}function Yp(e,t,n,r){let i=``;for(let e=parseInt(t);e<parseInt(n);e++)i+=r.replace(/\[\s*i\s*\]/g,`[ `+e+` ]`).replace(/UNROLLED_LOOP_INDEX/g,e);return i}function Xp(e){let t=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision===`highp`?t+=`
#define HIGH_PRECISION`:e.precision===`mediump`?t+=`
#define MEDIUM_PRECISION`:e.precision===`lowp`&&(t+=`
#define LOW_PRECISION`),t}var Zp={1:`SHADOWMAP_TYPE_PCF`,3:`SHADOWMAP_TYPE_VSM`};function Qp(e){return Zp[e.shadowMapType]||`SHADOWMAP_TYPE_BASIC`}var $p={301:`ENVMAP_TYPE_CUBE`,302:`ENVMAP_TYPE_CUBE`,306:`ENVMAP_TYPE_CUBE_UV`};function em(e){return e.envMap===!1?`ENVMAP_TYPE_CUBE`:$p[e.envMapMode]||`ENVMAP_TYPE_CUBE`}var tm={302:`ENVMAP_MODE_REFRACTION`};function nm(e){return e.envMap===!1?`ENVMAP_MODE_REFLECTION`:tm[e.envMapMode]||`ENVMAP_MODE_REFLECTION`}var rm={0:`ENVMAP_BLENDING_MULTIPLY`,1:`ENVMAP_BLENDING_MIX`,2:`ENVMAP_BLENDING_ADD`};function im(e){return e.envMap===!1?`ENVMAP_BLENDING_NONE`:rm[e.combine]||`ENVMAP_BLENDING_NONE`}function am(e){let t=e.envMapCubeUVHeight;if(t===null)return null;let n=Math.log2(t)-2,r=1/t;return{texelWidth:1/(3*Math.max(2**n,112)),texelHeight:r,maxMip:n}}function om(e,t,n,r){let i=e.getContext(),a=n.defines,o=n.vertexShader,s=n.fragmentShader,c=Qp(n),l=em(n),u=nm(n),d=im(n),f=am(n),p=Lp(n),m=Rp(a),h=i.createProgram(),g,_,v=n.glslVersion?`#version `+n.glslVersion+`
`:``;n.isRawShaderMaterial?(g=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(Bp).join(`
`),g.length>0&&(g+=`
`),_=[`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m].filter(Bp).join(`
`),_.length>0&&(_+=`
`)):(g=[Xp(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.extensionClipCullDistance?`#define USE_CLIP_DISTANCE`:``,n.batching?`#define USE_BATCHING`:``,n.batchingColor?`#define USE_BATCHING_COLOR`:``,n.instancing?`#define USE_INSTANCING`:``,n.instancingColor?`#define USE_INSTANCING_COLOR`:``,n.instancingMorph?`#define USE_INSTANCING_MORPH`:``,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.map?`#define USE_MAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+u:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.displacementMap?`#define USE_DISPLACEMENTMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.mapUv?`#define MAP_UV `+n.mapUv:``,n.alphaMapUv?`#define ALPHAMAP_UV `+n.alphaMapUv:``,n.lightMapUv?`#define LIGHTMAP_UV `+n.lightMapUv:``,n.aoMapUv?`#define AOMAP_UV `+n.aoMapUv:``,n.emissiveMapUv?`#define EMISSIVEMAP_UV `+n.emissiveMapUv:``,n.bumpMapUv?`#define BUMPMAP_UV `+n.bumpMapUv:``,n.normalMapUv?`#define NORMALMAP_UV `+n.normalMapUv:``,n.displacementMapUv?`#define DISPLACEMENTMAP_UV `+n.displacementMapUv:``,n.metalnessMapUv?`#define METALNESSMAP_UV `+n.metalnessMapUv:``,n.roughnessMapUv?`#define ROUGHNESSMAP_UV `+n.roughnessMapUv:``,n.anisotropyMapUv?`#define ANISOTROPYMAP_UV `+n.anisotropyMapUv:``,n.clearcoatMapUv?`#define CLEARCOATMAP_UV `+n.clearcoatMapUv:``,n.clearcoatNormalMapUv?`#define CLEARCOAT_NORMALMAP_UV `+n.clearcoatNormalMapUv:``,n.clearcoatRoughnessMapUv?`#define CLEARCOAT_ROUGHNESSMAP_UV `+n.clearcoatRoughnessMapUv:``,n.iridescenceMapUv?`#define IRIDESCENCEMAP_UV `+n.iridescenceMapUv:``,n.iridescenceThicknessMapUv?`#define IRIDESCENCE_THICKNESSMAP_UV `+n.iridescenceThicknessMapUv:``,n.sheenColorMapUv?`#define SHEEN_COLORMAP_UV `+n.sheenColorMapUv:``,n.sheenRoughnessMapUv?`#define SHEEN_ROUGHNESSMAP_UV `+n.sheenRoughnessMapUv:``,n.specularMapUv?`#define SPECULARMAP_UV `+n.specularMapUv:``,n.specularColorMapUv?`#define SPECULAR_COLORMAP_UV `+n.specularColorMapUv:``,n.specularIntensityMapUv?`#define SPECULAR_INTENSITYMAP_UV `+n.specularIntensityMapUv:``,n.transmissionMapUv?`#define TRANSMISSIONMAP_UV `+n.transmissionMapUv:``,n.thicknessMapUv?`#define THICKNESSMAP_UV `+n.thicknessMapUv:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexNormals?`#define HAS_NORMAL`:``,n.vertexColors?`#define USE_COLOR`:``,n.vertexAlphas?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.flatShading?`#define FLAT_SHADED`:``,n.skinning?`#define USE_SKINNING`:``,n.morphTargets?`#define USE_MORPHTARGETS`:``,n.morphNormals&&n.flatShading===!1?`#define USE_MORPHNORMALS`:``,n.morphColors?`#define USE_MORPHCOLORS`:``,n.morphTargetsCount>0?`#define MORPHTARGETS_TEXTURE_STRIDE `+n.morphTextureStride:``,n.morphTargetsCount>0?`#define MORPHTARGETS_COUNT `+n.morphTargetsCount:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.sizeAttenuation?`#define USE_SIZEATTENUATION`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 modelMatrix;`,`uniform mat4 modelViewMatrix;`,`uniform mat4 projectionMatrix;`,`uniform mat4 viewMatrix;`,`uniform mat3 normalMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,`#ifdef USE_INSTANCING`,`	attribute mat4 instanceMatrix;`,`#endif`,`#ifdef USE_INSTANCING_COLOR`,`	attribute vec3 instanceColor;`,`#endif`,`#ifdef USE_INSTANCING_MORPH`,`	uniform sampler2D morphTexture;`,`#endif`,`attribute vec3 position;`,`attribute vec3 normal;`,`attribute vec2 uv;`,`#ifdef USE_UV1`,`	attribute vec2 uv1;`,`#endif`,`#ifdef USE_UV2`,`	attribute vec2 uv2;`,`#endif`,`#ifdef USE_UV3`,`	attribute vec2 uv3;`,`#endif`,`#ifdef USE_TANGENT`,`	attribute vec4 tangent;`,`#endif`,`#if defined( USE_COLOR_ALPHA )`,`	attribute vec4 color;`,`#elif defined( USE_COLOR )`,`	attribute vec3 color;`,`#endif`,`#ifdef USE_SKINNING`,`	attribute vec4 skinIndex;`,`	attribute vec4 skinWeight;`,`#endif`,`
`].filter(Bp).join(`
`),_=[Xp(n),`#define SHADER_TYPE `+n.shaderType,`#define SHADER_NAME `+n.shaderName,m,n.useFog&&n.fog?`#define USE_FOG`:``,n.useFog&&n.fogExp2?`#define FOG_EXP2`:``,n.alphaToCoverage?`#define ALPHA_TO_COVERAGE`:``,n.map?`#define USE_MAP`:``,n.matcap?`#define USE_MATCAP`:``,n.envMap?`#define USE_ENVMAP`:``,n.envMap?`#define `+l:``,n.envMap?`#define `+u:``,n.envMap?`#define `+d:``,f?`#define CUBEUV_TEXEL_WIDTH `+f.texelWidth:``,f?`#define CUBEUV_TEXEL_HEIGHT `+f.texelHeight:``,f?`#define CUBEUV_MAX_MIP `+f.maxMip+`.0`:``,n.lightMap?`#define USE_LIGHTMAP`:``,n.aoMap?`#define USE_AOMAP`:``,n.bumpMap?`#define USE_BUMPMAP`:``,n.normalMap?`#define USE_NORMALMAP`:``,n.normalMapObjectSpace?`#define USE_NORMALMAP_OBJECTSPACE`:``,n.normalMapTangentSpace?`#define USE_NORMALMAP_TANGENTSPACE`:``,n.packedNormalMap?`#define USE_PACKED_NORMALMAP`:``,n.emissiveMap?`#define USE_EMISSIVEMAP`:``,n.anisotropy?`#define USE_ANISOTROPY`:``,n.anisotropyMap?`#define USE_ANISOTROPYMAP`:``,n.clearcoat?`#define USE_CLEARCOAT`:``,n.clearcoatMap?`#define USE_CLEARCOATMAP`:``,n.clearcoatRoughnessMap?`#define USE_CLEARCOAT_ROUGHNESSMAP`:``,n.clearcoatNormalMap?`#define USE_CLEARCOAT_NORMALMAP`:``,n.dispersion?`#define USE_DISPERSION`:``,n.iridescence?`#define USE_IRIDESCENCE`:``,n.iridescenceMap?`#define USE_IRIDESCENCEMAP`:``,n.iridescenceThicknessMap?`#define USE_IRIDESCENCE_THICKNESSMAP`:``,n.specularMap?`#define USE_SPECULARMAP`:``,n.specularColorMap?`#define USE_SPECULAR_COLORMAP`:``,n.specularIntensityMap?`#define USE_SPECULAR_INTENSITYMAP`:``,n.roughnessMap?`#define USE_ROUGHNESSMAP`:``,n.metalnessMap?`#define USE_METALNESSMAP`:``,n.alphaMap?`#define USE_ALPHAMAP`:``,n.alphaTest?`#define USE_ALPHATEST`:``,n.alphaHash?`#define USE_ALPHAHASH`:``,n.sheen?`#define USE_SHEEN`:``,n.sheenColorMap?`#define USE_SHEEN_COLORMAP`:``,n.sheenRoughnessMap?`#define USE_SHEEN_ROUGHNESSMAP`:``,n.transmission?`#define USE_TRANSMISSION`:``,n.transmissionMap?`#define USE_TRANSMISSIONMAP`:``,n.thicknessMap?`#define USE_THICKNESSMAP`:``,n.vertexTangents&&n.flatShading===!1?`#define USE_TANGENT`:``,n.vertexColors||n.instancingColor?`#define USE_COLOR`:``,n.vertexAlphas||n.batchingColor?`#define USE_COLOR_ALPHA`:``,n.vertexUv1s?`#define USE_UV1`:``,n.vertexUv2s?`#define USE_UV2`:``,n.vertexUv3s?`#define USE_UV3`:``,n.pointsUvs?`#define USE_POINTS_UV`:``,n.gradientMap?`#define USE_GRADIENTMAP`:``,n.flatShading?`#define FLAT_SHADED`:``,n.doubleSided?`#define DOUBLE_SIDED`:``,n.flipSided?`#define FLIP_SIDED`:``,n.shadowMapEnabled?`#define USE_SHADOWMAP`:``,n.shadowMapEnabled?`#define `+c:``,n.premultipliedAlpha?`#define PREMULTIPLIED_ALPHA`:``,n.numLightProbes>0?`#define USE_LIGHT_PROBES`:``,n.numLightProbeGrids>0?`#define USE_LIGHT_PROBES_GRID`:``,n.decodeVideoTexture?`#define DECODE_VIDEO_TEXTURE`:``,n.decodeVideoTextureEmissive?`#define DECODE_VIDEO_TEXTURE_EMISSIVE`:``,n.logarithmicDepthBuffer?`#define USE_LOGARITHMIC_DEPTH_BUFFER`:``,n.reversedDepthBuffer?`#define USE_REVERSED_DEPTH_BUFFER`:``,`uniform mat4 viewMatrix;`,`uniform vec3 cameraPosition;`,`uniform bool isOrthographic;`,n.toneMapping===0?``:`#define TONE_MAPPING`,n.toneMapping===0?``:jd.tonemapping_pars_fragment,n.toneMapping===0?``:Pp(`toneMapping`,n.toneMapping),n.dithering?`#define DITHERING`:``,n.opaque?`#define OPAQUE`:``,jd.colorspace_pars_fragment,Mp(`linearToOutputTexel`,n.outputColorSpace),Ip(),n.useDepthPacking?`#define DEPTH_PACKING `+n.depthPacking:``,`
`].filter(Bp).join(`
`)),o=Wp(o),o=Vp(o,n),o=Hp(o,n),s=Wp(s),s=Vp(s,n),s=Hp(s,n),o=Jp(o),s=Jp(s),n.isRawShaderMaterial!==!0&&(v=`#version 300 es
`,g=[p,`#define attribute in`,`#define varying out`,`#define texture2D texture`].join(`
`)+`
`+g,_=[`#define varying in`,n.glslVersion===`300 es`?``:`layout(location = 0) out highp vec4 pc_fragColor;`,n.glslVersion===`300 es`?``:`#define gl_FragColor pc_fragColor`,`#define gl_FragDepthEXT gl_FragDepth`,`#define texture2D texture`,`#define textureCube texture`,`#define texture2DProj textureProj`,`#define texture2DLodEXT textureLod`,`#define texture2DProjLodEXT textureProjLod`,`#define textureCubeLodEXT textureLod`,`#define texture2DGradEXT textureGrad`,`#define texture2DProjGradEXT textureProjGrad`,`#define textureCubeGradEXT textureGrad`].join(`
`)+`
`+_);let y=v+g+o,b=v+_+s,x=Tp(i,i.VERTEX_SHADER,y),S=Tp(i,i.FRAGMENT_SHADER,b);i.attachShader(h,x),i.attachShader(h,S),n.index0AttributeName===void 0?n.morphTargets===!0&&i.bindAttribLocation(h,0,`position`):i.bindAttribLocation(h,0,n.index0AttributeName),i.linkProgram(h);function C(t){if(e.debug.checkShaderErrors){let n=i.getProgramInfoLog(h)||``,r=i.getShaderInfoLog(x)||``,a=i.getShaderInfoLog(S)||``,o=n.trim(),s=r.trim(),c=a.trim(),l=!0,u=!0;if(i.getProgramParameter(h,i.LINK_STATUS)===!1)if(l=!1,typeof e.debug.onShaderError==`function`)e.debug.onShaderError(i,h,x,S);else{let e=jp(i,x,`vertex`),n=jp(i,S,`fragment`);K(`THREE.WebGLProgram: Shader Error `+i.getError()+` - VALIDATE_STATUS `+i.getProgramParameter(h,i.VALIDATE_STATUS)+`

Material Name: `+t.name+`
Material Type: `+t.type+`

Program Info Log: `+o+`
`+e+`
`+n)}else o===``?(s===``||c===``)&&(u=!1):G(`WebGLProgram: Program Info Log:`,o);u&&(t.diagnostics={runnable:l,programLog:o,vertexShader:{log:s,prefix:g},fragmentShader:{log:c,prefix:_}})}i.deleteShader(x),i.deleteShader(S),w=new wp(i,h),T=zp(i,h)}let w;this.getUniforms=function(){return w===void 0&&C(this),w};let T;this.getAttributes=function(){return T===void 0&&C(this),T};let E=n.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return E===!1&&(E=i.getProgramParameter(h,Ep)),E},this.destroy=function(){r.releaseStatesOfProgram(this),i.deleteProgram(h),this.program=void 0},this.type=n.shaderType,this.name=n.shaderName,this.id=Dp++,this.cacheKey=t,this.usedTimes=1,this.program=h,this.vertexShader=x,this.fragmentShader=S,this}var sm=0,cm=class{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e){let t=e.vertexShader,n=e.fragmentShader,r=this._getShaderStage(t),i=this._getShaderStage(n),a=this._getShaderCacheForMaterial(e);return a.has(r)===!1&&(a.add(r),r.usedTimes++),a.has(i)===!1&&(a.add(i),i.usedTimes++),this}remove(e){let t=this.materialCache.get(e);for(let e of t)e.usedTimes--,e.usedTimes===0&&this.shaderCache.delete(e.code);return this.materialCache.delete(e),this}getVertexShaderID(e){return this._getShaderStage(e.vertexShader).id}getFragmentShaderID(e){return this._getShaderStage(e.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){let t=this.materialCache,n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){let t=this.shaderCache,n=t.get(e);return n===void 0&&(n=new lm(e),t.set(e,n)),n}},lm=class{constructor(e){this.id=sm++,this.code=e,this.usedTimes=0}};function um(e){return e===1030||e===37490||e===36285}function dm(e,t,n,r,i,a){let o=new Hs,s=new cm,c=new Set,l=[],u=new Map,d=r.logarithmicDepthBuffer,f=r.precision,p={MeshDepthMaterial:`depth`,MeshDistanceMaterial:`distance`,MeshNormalMaterial:`normal`,MeshBasicMaterial:`basic`,MeshLambertMaterial:`lambert`,MeshPhongMaterial:`phong`,MeshToonMaterial:`toon`,MeshStandardMaterial:`physical`,MeshPhysicalMaterial:`physical`,MeshMatcapMaterial:`matcap`,LineBasicMaterial:`basic`,LineDashedMaterial:`dashed`,PointsMaterial:`points`,ShadowMaterial:`shadow`,SpriteMaterial:`sprite`};function m(e){return c.add(e),e===0?`uv`:`uv${e}`}function h(i,o,l,u,h,g){let _=u.fog,v=h.geometry,y=i.isMeshStandardMaterial||i.isMeshLambertMaterial||i.isMeshPhongMaterial?u.environment:null,b=i.isMeshStandardMaterial||i.isMeshLambertMaterial&&!i.envMap||i.isMeshPhongMaterial&&!i.envMap,x=t.get(i.envMap||y,b),S=x&&x.mapping===306?x.image.height:null,C=p[i.type];i.precision!==null&&(f=r.getMaxPrecision(i.precision),f!==i.precision&&G(`WebGLProgram.getParameters:`,i.precision,`not supported, using`,f,`instead.`));let w=v.morphAttributes.position||v.morphAttributes.normal||v.morphAttributes.color,T=w===void 0?0:w.length,E=0;v.morphAttributes.position!==void 0&&(E=1),v.morphAttributes.normal!==void 0&&(E=2),v.morphAttributes.color!==void 0&&(E=3);let D,O,k,A;if(C){let e=Md[C];D=e.vertexShader,O=e.fragmentShader}else D=i.vertexShader,O=i.fragmentShader,s.update(i),k=s.getVertexShaderID(i),A=s.getFragmentShaderID(i);let j=e.getRenderTarget(),M=e.state.buffers.depth.getReversed(),N=h.isInstancedMesh===!0,P=h.isBatchedMesh===!0,F=!!i.map,I=!!i.matcap,ee=!!x,L=!!i.aoMap,te=!!i.lightMap,R=!!i.bumpMap,ne=!!i.normalMap,re=!!i.displacementMap,ie=!!i.emissiveMap,ae=!!i.metalnessMap,oe=!!i.roughnessMap,se=i.anisotropy>0,ce=i.clearcoat>0,le=i.dispersion>0,ue=i.iridescence>0,de=i.sheen>0,fe=i.transmission>0,pe=se&&!!i.anisotropyMap,me=ce&&!!i.clearcoatMap,he=ce&&!!i.clearcoatNormalMap,z=ce&&!!i.clearcoatRoughnessMap,ge=ue&&!!i.iridescenceMap,_e=ue&&!!i.iridescenceThicknessMap,ve=de&&!!i.sheenColorMap,B=de&&!!i.sheenRoughnessMap,ye=!!i.specularMap,V=!!i.specularColorMap,H=!!i.specularIntensityMap,be=fe&&!!i.transmissionMap,xe=fe&&!!i.thicknessMap,Se=!!i.gradientMap,Ce=!!i.alphaMap,we=i.alphaTest>0,Te=!!i.alphaHash,Ee=!!i.extensions,De=0;i.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(De=e.toneMapping);let Oe={shaderID:C,shaderType:i.type,shaderName:i.name,vertexShader:D,fragmentShader:O,defines:i.defines,customVertexShaderID:k,customFragmentShaderID:A,isRawShaderMaterial:i.isRawShaderMaterial===!0,glslVersion:i.glslVersion,precision:f,batching:P,batchingColor:P&&h._colorsTexture!==null,instancing:N,instancingColor:N&&h.instanceColor!==null,instancingMorph:N&&h.morphTexture!==null,outputColorSpace:j===null?e.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:hs.workingColorSpace,alphaToCoverage:!!i.alphaToCoverage,map:F,matcap:I,envMap:ee,envMapMode:ee&&x.mapping,envMapCubeUVHeight:S,aoMap:L,lightMap:te,bumpMap:R,normalMap:ne,displacementMap:re,emissiveMap:ie,normalMapObjectSpace:ne&&i.normalMapType===1,normalMapTangentSpace:ne&&i.normalMapType===0,packedNormalMap:ne&&i.normalMapType===0&&um(i.normalMap.format),metalnessMap:ae,roughnessMap:oe,anisotropy:se,anisotropyMap:pe,clearcoat:ce,clearcoatMap:me,clearcoatNormalMap:he,clearcoatRoughnessMap:z,dispersion:le,iridescence:ue,iridescenceMap:ge,iridescenceThicknessMap:_e,sheen:de,sheenColorMap:ve,sheenRoughnessMap:B,specularMap:ye,specularColorMap:V,specularIntensityMap:H,transmission:fe,transmissionMap:be,thicknessMap:xe,gradientMap:Se,opaque:i.transparent===!1&&i.blending===1&&i.alphaToCoverage===!1,alphaMap:Ce,alphaTest:we,alphaHash:Te,combine:i.combine,mapUv:F&&m(i.map.channel),aoMapUv:L&&m(i.aoMap.channel),lightMapUv:te&&m(i.lightMap.channel),bumpMapUv:R&&m(i.bumpMap.channel),normalMapUv:ne&&m(i.normalMap.channel),displacementMapUv:re&&m(i.displacementMap.channel),emissiveMapUv:ie&&m(i.emissiveMap.channel),metalnessMapUv:ae&&m(i.metalnessMap.channel),roughnessMapUv:oe&&m(i.roughnessMap.channel),anisotropyMapUv:pe&&m(i.anisotropyMap.channel),clearcoatMapUv:me&&m(i.clearcoatMap.channel),clearcoatNormalMapUv:he&&m(i.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:z&&m(i.clearcoatRoughnessMap.channel),iridescenceMapUv:ge&&m(i.iridescenceMap.channel),iridescenceThicknessMapUv:_e&&m(i.iridescenceThicknessMap.channel),sheenColorMapUv:ve&&m(i.sheenColorMap.channel),sheenRoughnessMapUv:B&&m(i.sheenRoughnessMap.channel),specularMapUv:ye&&m(i.specularMap.channel),specularColorMapUv:V&&m(i.specularColorMap.channel),specularIntensityMapUv:H&&m(i.specularIntensityMap.channel),transmissionMapUv:be&&m(i.transmissionMap.channel),thicknessMapUv:xe&&m(i.thicknessMap.channel),alphaMapUv:Ce&&m(i.alphaMap.channel),vertexTangents:!!v.attributes.tangent&&(ne||se),vertexNormals:!!v.attributes.normal,vertexColors:i.vertexColors,vertexAlphas:i.vertexColors===!0&&!!v.attributes.color&&v.attributes.color.itemSize===4,pointsUvs:h.isPoints===!0&&!!v.attributes.uv&&(F||Ce),fog:!!_,useFog:i.fog===!0,fogExp2:!!_&&_.isFogExp2,flatShading:i.wireframe===!1&&(i.flatShading===!0||v.attributes.normal===void 0&&ne===!1&&(i.isMeshLambertMaterial||i.isMeshPhongMaterial||i.isMeshStandardMaterial||i.isMeshPhysicalMaterial)),sizeAttenuation:i.sizeAttenuation===!0,logarithmicDepthBuffer:d,reversedDepthBuffer:M,skinning:h.isSkinnedMesh===!0,morphTargets:v.morphAttributes.position!==void 0,morphNormals:v.morphAttributes.normal!==void 0,morphColors:v.morphAttributes.color!==void 0,morphTargetsCount:T,morphTextureStride:E,numDirLights:o.directional.length,numPointLights:o.point.length,numSpotLights:o.spot.length,numSpotLightMaps:o.spotLightMap.length,numRectAreaLights:o.rectArea.length,numHemiLights:o.hemi.length,numDirLightShadows:o.directionalShadowMap.length,numPointLightShadows:o.pointShadowMap.length,numSpotLightShadows:o.spotShadowMap.length,numSpotLightShadowsWithMaps:o.numSpotLightShadowsWithMaps,numLightProbes:o.numLightProbes,numLightProbeGrids:g.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:i.dithering,shadowMapEnabled:e.shadowMap.enabled&&l.length>0,shadowMapType:e.shadowMap.type,toneMapping:De,decodeVideoTexture:F&&i.map.isVideoTexture===!0&&hs.getTransfer(i.map.colorSpace)===`srgb`,decodeVideoTextureEmissive:ie&&i.emissiveMap.isVideoTexture===!0&&hs.getTransfer(i.emissiveMap.colorSpace)===`srgb`,premultipliedAlpha:i.premultipliedAlpha,doubleSided:i.side===2,flipSided:i.side===1,useDepthPacking:i.depthPacking>=0,depthPacking:i.depthPacking||0,index0AttributeName:i.index0AttributeName,extensionClipCullDistance:Ee&&i.extensions.clipCullDistance===!0&&n.has(`WEBGL_clip_cull_distance`),extensionMultiDraw:(Ee&&i.extensions.multiDraw===!0||P)&&n.has(`WEBGL_multi_draw`),rendererExtensionParallelShaderCompile:n.has(`KHR_parallel_shader_compile`),customProgramCacheKey:i.customProgramCacheKey()};return Oe.vertexUv1s=c.has(1),Oe.vertexUv2s=c.has(2),Oe.vertexUv3s=c.has(3),c.clear(),Oe}function g(t){let n=[];if(t.shaderID?n.push(t.shaderID):(n.push(t.customVertexShaderID),n.push(t.customFragmentShaderID)),t.defines!==void 0)for(let e in t.defines)n.push(e),n.push(t.defines[e]);return t.isRawShaderMaterial===!1&&(_(n,t),v(n,t),n.push(e.outputColorSpace)),n.push(t.customProgramCacheKey),n.join()}function _(e,t){e.push(t.precision),e.push(t.outputColorSpace),e.push(t.envMapMode),e.push(t.envMapCubeUVHeight),e.push(t.mapUv),e.push(t.alphaMapUv),e.push(t.lightMapUv),e.push(t.aoMapUv),e.push(t.bumpMapUv),e.push(t.normalMapUv),e.push(t.displacementMapUv),e.push(t.emissiveMapUv),e.push(t.metalnessMapUv),e.push(t.roughnessMapUv),e.push(t.anisotropyMapUv),e.push(t.clearcoatMapUv),e.push(t.clearcoatNormalMapUv),e.push(t.clearcoatRoughnessMapUv),e.push(t.iridescenceMapUv),e.push(t.iridescenceThicknessMapUv),e.push(t.sheenColorMapUv),e.push(t.sheenRoughnessMapUv),e.push(t.specularMapUv),e.push(t.specularColorMapUv),e.push(t.specularIntensityMapUv),e.push(t.transmissionMapUv),e.push(t.thicknessMapUv),e.push(t.combine),e.push(t.fogExp2),e.push(t.sizeAttenuation),e.push(t.morphTargetsCount),e.push(t.morphAttributeCount),e.push(t.numDirLights),e.push(t.numPointLights),e.push(t.numSpotLights),e.push(t.numSpotLightMaps),e.push(t.numHemiLights),e.push(t.numRectAreaLights),e.push(t.numDirLightShadows),e.push(t.numPointLightShadows),e.push(t.numSpotLightShadows),e.push(t.numSpotLightShadowsWithMaps),e.push(t.numLightProbes),e.push(t.shadowMapType),e.push(t.toneMapping),e.push(t.numClippingPlanes),e.push(t.numClipIntersection),e.push(t.depthPacking)}function v(e,t){o.disableAll(),t.instancing&&o.enable(0),t.instancingColor&&o.enable(1),t.instancingMorph&&o.enable(2),t.matcap&&o.enable(3),t.envMap&&o.enable(4),t.normalMapObjectSpace&&o.enable(5),t.normalMapTangentSpace&&o.enable(6),t.clearcoat&&o.enable(7),t.iridescence&&o.enable(8),t.alphaTest&&o.enable(9),t.vertexColors&&o.enable(10),t.vertexAlphas&&o.enable(11),t.vertexUv1s&&o.enable(12),t.vertexUv2s&&o.enable(13),t.vertexUv3s&&o.enable(14),t.vertexTangents&&o.enable(15),t.anisotropy&&o.enable(16),t.alphaHash&&o.enable(17),t.batching&&o.enable(18),t.dispersion&&o.enable(19),t.batchingColor&&o.enable(20),t.gradientMap&&o.enable(21),t.packedNormalMap&&o.enable(22),t.vertexNormals&&o.enable(23),e.push(o.mask),o.disableAll(),t.fog&&o.enable(0),t.useFog&&o.enable(1),t.flatShading&&o.enable(2),t.logarithmicDepthBuffer&&o.enable(3),t.reversedDepthBuffer&&o.enable(4),t.skinning&&o.enable(5),t.morphTargets&&o.enable(6),t.morphNormals&&o.enable(7),t.morphColors&&o.enable(8),t.premultipliedAlpha&&o.enable(9),t.shadowMapEnabled&&o.enable(10),t.doubleSided&&o.enable(11),t.flipSided&&o.enable(12),t.useDepthPacking&&o.enable(13),t.dithering&&o.enable(14),t.transmission&&o.enable(15),t.sheen&&o.enable(16),t.opaque&&o.enable(17),t.pointsUvs&&o.enable(18),t.decodeVideoTexture&&o.enable(19),t.decodeVideoTextureEmissive&&o.enable(20),t.alphaToCoverage&&o.enable(21),t.numLightProbeGrids>0&&o.enable(22),e.push(o.mask)}function y(e){let t=p[e.type],n;if(t){let e=Md[t];n=hu.clone(e.uniforms)}else n=e.uniforms;return n}function b(t,n){let r=u.get(n);return r===void 0?(r=new om(e,n,t,i),l.push(r),u.set(n,r)):++r.usedTimes,r}function x(e){if(--e.usedTimes===0){let t=l.indexOf(e);l[t]=l[l.length-1],l.pop(),u.delete(e.cacheKey),e.destroy()}}function S(e){s.remove(e)}function C(){s.dispose()}return{getParameters:h,getProgramCacheKey:g,getUniforms:y,acquireProgram:b,releaseProgram:x,releaseShaderCache:S,programs:l,dispose:C}}function fm(){let e=new WeakMap;function t(t){return e.has(t)}function n(t){let n=e.get(t);return n===void 0&&(n={},e.set(t,n)),n}function r(t){e.delete(t)}function i(t,n,r){e.get(t)[n]=r}function a(){e=new WeakMap}return{has:t,get:n,remove:r,update:i,dispose:a}}function pm(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.material.id===t.material.id?e.materialVariant===t.materialVariant?e.z===t.z?e.id-t.id:e.z-t.z:e.materialVariant-t.materialVariant:e.material.id-t.material.id:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function mm(e,t){return e.groupOrder===t.groupOrder?e.renderOrder===t.renderOrder?e.z===t.z?e.id-t.id:t.z-e.z:e.renderOrder-t.renderOrder:e.groupOrder-t.groupOrder}function hm(){let e=[],t=0,n=[],r=[],i=[];function a(){t=0,n.length=0,r.length=0,i.length=0}function o(e){let t=0;return e.isInstancedMesh&&(t+=2),e.isSkinnedMesh&&(t+=1),t}function s(n,r,i,a,s,c){let l=e[t];return l===void 0?(l={id:n.id,object:n,geometry:r,material:i,materialVariant:o(n),groupOrder:a,renderOrder:n.renderOrder,z:s,group:c},e[t]=l):(l.id=n.id,l.object=n,l.geometry=r,l.material=i,l.materialVariant=o(n),l.groupOrder=a,l.renderOrder=n.renderOrder,l.z=s,l.group=c),t++,l}function c(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.push(u):a.transparent===!0?i.push(u):n.push(u)}function l(e,t,a,o,c,l){let u=s(e,t,a,o,c,l);a.transmission>0?r.unshift(u):a.transparent===!0?i.unshift(u):n.unshift(u)}function u(e,t){n.length>1&&n.sort(e||pm),r.length>1&&r.sort(t||mm),i.length>1&&i.sort(t||mm)}function d(){for(let n=t,r=e.length;n<r;n++){let t=e[n];if(t.id===null)break;t.id=null,t.object=null,t.geometry=null,t.material=null,t.group=null}}return{opaque:n,transmissive:r,transparent:i,init:a,push:c,unshift:l,finish:d,sort:u}}function gm(){let e=new WeakMap;function t(t,n){let r=e.get(t),i;return r===void 0?(i=new hm,e.set(t,[i])):n>=r.length?(i=new hm,r.push(i)):i=r[n],i}function n(){e=new WeakMap}return{get:t,dispose:n}}function _m(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`DirectionalLight`:n={direction:new J,color:new X};break;case`SpotLight`:n={position:new J,direction:new J,color:new X,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case`PointLight`:n={position:new J,color:new X,distance:0,decay:0};break;case`HemisphereLight`:n={direction:new J,skyColor:new X,groundColor:new X};break;case`RectAreaLight`:n={color:new X,position:new J,halfWidth:new J,halfHeight:new J};break}return e[t.id]=n,n}}}function vm(){let e={};return{get:function(t){if(e[t.id]!==void 0)return e[t.id];let n;switch(t.type){case`DirectionalLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new q};break;case`SpotLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new q};break;case`PointLight`:n={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new q,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[t.id]=n,n}}}var ym=0;function bm(e,t){return(t.castShadow?2:0)-(e.castShadow?2:0)+ +!!t.map-!!e.map}function xm(e){let t=new _m,n=vm(),r={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let e=0;e<9;e++)r.probe.push(new J);let i=new J,a=new js,o=new js;function s(i){let a=0,o=0,s=0;for(let e=0;e<9;e++)r.probe[e].set(0,0,0);let c=0,l=0,u=0,d=0,f=0,p=0,m=0,h=0,g=0,_=0,v=0;i.sort(bm);for(let e=0,y=i.length;e<y;e++){let y=i[e],b=y.color,x=y.intensity,S=y.distance,C=null;if(y.shadow&&y.shadow.map&&(C=y.shadow.map.texture.format===1030?y.shadow.map.texture:y.shadow.map.depthTexture||y.shadow.map.texture),y.isAmbientLight)a+=b.r*x,o+=b.g*x,s+=b.b*x;else if(y.isLightProbe){for(let e=0;e<9;e++)r.probe[e].addScaledVector(y.sh.coefficients[e],x);v++}else if(y.isDirectionalLight){let e=t.get(y);if(e.color.copy(y.color).multiplyScalar(y.intensity),y.castShadow){let e=y.shadow,t=n.get(y);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,r.directionalShadow[c]=t,r.directionalShadowMap[c]=C,r.directionalShadowMatrix[c]=y.shadow.matrix,p++}r.directional[c]=e,c++}else if(y.isSpotLight){let e=t.get(y);e.position.setFromMatrixPosition(y.matrixWorld),e.color.copy(b).multiplyScalar(x),e.distance=S,e.coneCos=Math.cos(y.angle),e.penumbraCos=Math.cos(y.angle*(1-y.penumbra)),e.decay=y.decay,r.spot[u]=e;let i=y.shadow;if(y.map&&(r.spotLightMap[g]=y.map,g++,i.updateMatrices(y),y.castShadow&&_++),r.spotLightMatrix[u]=i.matrix,y.castShadow){let e=n.get(y);e.shadowIntensity=i.intensity,e.shadowBias=i.bias,e.shadowNormalBias=i.normalBias,e.shadowRadius=i.radius,e.shadowMapSize=i.mapSize,r.spotShadow[u]=e,r.spotShadowMap[u]=C,h++}u++}else if(y.isRectAreaLight){let e=t.get(y);e.color.copy(b).multiplyScalar(x),e.halfWidth.set(y.width*.5,0,0),e.halfHeight.set(0,y.height*.5,0),r.rectArea[d]=e,d++}else if(y.isPointLight){let e=t.get(y);if(e.color.copy(y.color).multiplyScalar(y.intensity),e.distance=y.distance,e.decay=y.decay,y.castShadow){let e=y.shadow,t=n.get(y);t.shadowIntensity=e.intensity,t.shadowBias=e.bias,t.shadowNormalBias=e.normalBias,t.shadowRadius=e.radius,t.shadowMapSize=e.mapSize,t.shadowCameraNear=e.camera.near,t.shadowCameraFar=e.camera.far,r.pointShadow[l]=t,r.pointShadowMap[l]=C,r.pointShadowMatrix[l]=y.shadow.matrix,m++}r.point[l]=e,l++}else if(y.isHemisphereLight){let e=t.get(y);e.skyColor.copy(y.color).multiplyScalar(x),e.groundColor.copy(y.groundColor).multiplyScalar(x),r.hemi[f]=e,f++}}d>0&&(e.has(`OES_texture_float_linear`)===!0?(r.rectAreaLTC1=Z.LTC_FLOAT_1,r.rectAreaLTC2=Z.LTC_FLOAT_2):(r.rectAreaLTC1=Z.LTC_HALF_1,r.rectAreaLTC2=Z.LTC_HALF_2)),r.ambient[0]=a,r.ambient[1]=o,r.ambient[2]=s;let y=r.hash;(y.directionalLength!==c||y.pointLength!==l||y.spotLength!==u||y.rectAreaLength!==d||y.hemiLength!==f||y.numDirectionalShadows!==p||y.numPointShadows!==m||y.numSpotShadows!==h||y.numSpotMaps!==g||y.numLightProbes!==v)&&(r.directional.length=c,r.spot.length=u,r.rectArea.length=d,r.point.length=l,r.hemi.length=f,r.directionalShadow.length=p,r.directionalShadowMap.length=p,r.pointShadow.length=m,r.pointShadowMap.length=m,r.spotShadow.length=h,r.spotShadowMap.length=h,r.directionalShadowMatrix.length=p,r.pointShadowMatrix.length=m,r.spotLightMatrix.length=h+g-_,r.spotLightMap.length=g,r.numSpotLightShadowsWithMaps=_,r.numLightProbes=v,y.directionalLength=c,y.pointLength=l,y.spotLength=u,y.rectAreaLength=d,y.hemiLength=f,y.numDirectionalShadows=p,y.numPointShadows=m,y.numSpotShadows=h,y.numSpotMaps=g,y.numLightProbes=v,r.version=ym++)}function c(e,t){let n=0,s=0,c=0,l=0,u=0,d=t.matrixWorldInverse;for(let t=0,f=e.length;t<f;t++){let f=e[t];if(f.isDirectionalLight){let e=r.directional[n];e.direction.setFromMatrixPosition(f.matrixWorld),i.setFromMatrixPosition(f.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(d),n++}else if(f.isSpotLight){let e=r.spot[c];e.position.setFromMatrixPosition(f.matrixWorld),e.position.applyMatrix4(d),e.direction.setFromMatrixPosition(f.matrixWorld),i.setFromMatrixPosition(f.target.matrixWorld),e.direction.sub(i),e.direction.transformDirection(d),c++}else if(f.isRectAreaLight){let e=r.rectArea[l];e.position.setFromMatrixPosition(f.matrixWorld),e.position.applyMatrix4(d),o.identity(),a.copy(f.matrixWorld),a.premultiply(d),o.extractRotation(a),e.halfWidth.set(f.width*.5,0,0),e.halfHeight.set(0,f.height*.5,0),e.halfWidth.applyMatrix4(o),e.halfHeight.applyMatrix4(o),l++}else if(f.isPointLight){let e=r.point[s];e.position.setFromMatrixPosition(f.matrixWorld),e.position.applyMatrix4(d),s++}else if(f.isHemisphereLight){let e=r.hemi[u];e.direction.setFromMatrixPosition(f.matrixWorld),e.direction.transformDirection(d),u++}}}return{setup:s,setupView:c,state:r}}function Sm(e){let t=new xm(e),n=[],r=[],i=[];function a(e){d.camera=e,n.length=0,r.length=0,i.length=0}function o(e){n.push(e)}function s(e){r.push(e)}function c(e){i.push(e)}function l(){t.setup(n)}function u(e){t.setupView(n,e)}let d={lightsArray:n,shadowsArray:r,lightProbeGridArray:i,camera:null,lights:t,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:d,setupLights:l,setupLightsView:u,pushLight:o,pushShadow:s,pushLightProbeGrid:c}}function Cm(e){let t=new WeakMap;function n(n,r=0){let i=t.get(n),a;return i===void 0?(a=new Sm(e),t.set(n,[a])):r>=i.length?(a=new Sm(e),i.push(a)):a=i[r],a}function r(){t=new WeakMap}return{get:n,dispose:r}}var wm=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Tm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,Em=[new J(1,0,0),new J(-1,0,0),new J(0,1,0),new J(0,-1,0),new J(0,0,1),new J(0,0,-1)],Dm=[new J(0,-1,0),new J(0,-1,0),new J(0,0,1),new J(0,0,-1),new J(0,-1,0),new J(0,-1,0)],Om=new js,km=new J,Am=new J;function jm(e,t,n){let r=new Xl,i=new q,a=new q,o=new Es,s=new Su,c=new Cu,l={},u=n.maxTextureSize,d={0:1,1:0,2:2},f=new vu({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new q},radius:{value:4}},vertexShader:wm,fragmentShader:Tm}),p=f.clone();p.defines.HORIZONTAL_PASS=1;let m=new sl;m.setAttribute(`position`,new Kc(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));let h=new Al(m,f),g=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=1;let _=this.type;this.render=function(t,n,s){if(g.enabled===!1||g.autoUpdate===!1&&g.needsUpdate===!1||t.length===0)return;this.type===2&&(G(`WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead.`),this.type=1);let c=e.getRenderTarget(),l=e.getActiveCubeFace(),d=e.getActiveMipmapLevel(),f=e.state;f.setBlending(0),f.buffers.depth.getReversed()===!0?f.buffers.color.setClear(0,0,0,0):f.buffers.color.setClear(1,1,1,1),f.buffers.depth.setTest(!0),f.setScissorTest(!1);let p=_!==this.type;p&&n.traverse(function(e){e.material&&(Array.isArray(e.material)?e.material.forEach(e=>e.needsUpdate=!0):e.material.needsUpdate=!0)});for(let c=0,l=t.length;c<l;c++){let l=t[c],d=l.shadow;if(d===void 0){G(`WebGLShadowMap:`,l,`has no shadow.`);continue}if(d.autoUpdate===!1&&d.needsUpdate===!1)continue;i.copy(d.mapSize);let m=d.getFrameExtents();i.multiply(m),a.copy(d.mapSize),(i.x>u||i.y>u)&&(i.x>u&&(a.x=Math.floor(u/m.x),i.x=a.x*m.x,d.mapSize.x=a.x),i.y>u&&(a.y=Math.floor(u/m.y),i.y=a.y*m.y,d.mapSize.y=a.y));let h=e.state.buffers.depth.getReversed();if(d.camera._reversedDepth=h,d.map===null||p===!0){if(d.map!==null&&(d.map.depthTexture!==null&&(d.map.depthTexture.dispose(),d.map.depthTexture=null),d.map.dispose()),this.type===3){if(l.isPointLight){G(`WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.`);continue}d.map=new Os(i.x,i.y,{format:Sa,type:la,minFilter:$i,magFilter:$i,generateMipmaps:!1}),d.map.texture.name=l.name+`.shadowMap`,d.map.depthTexture=new au(i.x,i.y,ca),d.map.depthTexture.name=l.name+`.shadowMapDepth`,d.map.depthTexture.format=va,d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=Xi,d.map.depthTexture.magFilter=Xi}else l.isPointLight?(d.map=new cf(i.x),d.map.depthTexture=new ou(i.x,sa)):(d.map=new Os(i.x,i.y),d.map.depthTexture=new au(i.x,i.y,sa)),d.map.depthTexture.name=l.name+`.shadowMap`,d.map.depthTexture.format=va,this.type===1?(d.map.depthTexture.compareFunction=h?518:515,d.map.depthTexture.minFilter=$i,d.map.depthTexture.magFilter=$i):(d.map.depthTexture.compareFunction=null,d.map.depthTexture.minFilter=Xi,d.map.depthTexture.magFilter=Xi);d.camera.updateProjectionMatrix()}let g=d.map.isWebGLCubeRenderTarget?6:1;for(let t=0;t<g;t++){if(d.map.isWebGLCubeRenderTarget)e.setRenderTarget(d.map,t),e.clear();else{t===0&&(e.setRenderTarget(d.map),e.clear());let n=d.getViewport(t);o.set(a.x*n.x,a.y*n.y,a.x*n.z,a.y*n.w),f.viewport(o)}if(l.isPointLight){let e=d.camera,n=d.matrix,r=l.distance||e.far;r!==e.far&&(e.far=r,e.updateProjectionMatrix()),km.setFromMatrixPosition(l.matrixWorld),e.position.copy(km),Am.copy(e.position),Am.add(Em[t]),e.up.copy(Dm[t]),e.lookAt(Am),e.updateMatrixWorld(),n.makeTranslation(-km.x,-km.y,-km.z),Om.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),d._frustum.setFromProjectionMatrix(Om,e.coordinateSystem,e.reversedDepth)}else d.updateMatrices(l);r=d.getFrustum(),b(n,s,d.camera,l,this.type)}d.isPointLightShadow!==!0&&this.type===3&&v(d,s),d.needsUpdate=!1}_=this.type,g.needsUpdate=!1,e.setRenderTarget(c,l,d)};function v(n,r){let a=t.update(h);f.defines.VSM_SAMPLES!==n.blurSamples&&(f.defines.VSM_SAMPLES=n.blurSamples,p.defines.VSM_SAMPLES=n.blurSamples,f.needsUpdate=!0,p.needsUpdate=!0),n.mapPass===null&&(n.mapPass=new Os(i.x,i.y,{format:Sa,type:la})),f.uniforms.shadow_pass.value=n.map.depthTexture,f.uniforms.resolution.value=n.mapSize,f.uniforms.radius.value=n.radius,e.setRenderTarget(n.mapPass),e.clear(),e.renderBufferDirect(r,null,a,f,h,null),p.uniforms.shadow_pass.value=n.mapPass.texture,p.uniforms.resolution.value=n.mapSize,p.uniforms.radius.value=n.radius,e.setRenderTarget(n.map),e.clear(),e.renderBufferDirect(r,null,a,p,h,null)}function y(t,n,r,i){let a=null,o=r.isPointLight===!0?t.customDistanceMaterial:t.customDepthMaterial;if(o!==void 0)a=o;else if(a=r.isPointLight===!0?c:s,e.localClippingEnabled&&n.clipShadows===!0&&Array.isArray(n.clippingPlanes)&&n.clippingPlanes.length!==0||n.displacementMap&&n.displacementScale!==0||n.alphaMap&&n.alphaTest>0||n.map&&n.alphaTest>0||n.alphaToCoverage===!0){let e=a.uuid,t=n.uuid,r=l[e];r===void 0&&(r={},l[e]=r);let i=r[t];i===void 0&&(i=a.clone(),r[t]=i,n.addEventListener(`dispose`,x)),a=i}if(a.visible=n.visible,a.wireframe=n.wireframe,i===3?a.side=n.shadowSide===null?n.side:n.shadowSide:a.side=n.shadowSide===null?d[n.side]:n.shadowSide,a.alphaMap=n.alphaMap,a.alphaTest=n.alphaToCoverage===!0?.5:n.alphaTest,a.map=n.map,a.clipShadows=n.clipShadows,a.clippingPlanes=n.clippingPlanes,a.clipIntersection=n.clipIntersection,a.displacementMap=n.displacementMap,a.displacementScale=n.displacementScale,a.displacementBias=n.displacementBias,a.wireframeLinewidth=n.wireframeLinewidth,a.linewidth=n.linewidth,r.isPointLight===!0&&a.isMeshDistanceMaterial===!0){let t=e.properties.get(a);t.light=r}return a}function b(n,i,a,o,s){if(n.visible===!1)return;if(n.layers.test(i.layers)&&(n.isMesh||n.isLine||n.isPoints)&&(n.castShadow||n.receiveShadow&&s===3)&&(!n.frustumCulled||r.intersectsObject(n))){n.modelViewMatrix.multiplyMatrices(a.matrixWorldInverse,n.matrixWorld);let r=t.update(n),c=n.material;if(Array.isArray(c)){let t=r.groups;for(let l=0,u=t.length;l<u;l++){let u=t[l],d=c[u.materialIndex];if(d&&d.visible){let t=y(n,d,o,s);n.onBeforeShadow(e,n,i,a,r,t,u),e.renderBufferDirect(a,null,r,t,n,u),n.onAfterShadow(e,n,i,a,r,t,u)}}}else if(c.visible){let t=y(n,c,o,s);n.onBeforeShadow(e,n,i,a,r,t,null),e.renderBufferDirect(a,null,r,t,n,null),n.onAfterShadow(e,n,i,a,r,t,null)}}let c=n.children;for(let e=0,t=c.length;e<t;e++)b(c[e],i,a,o,s)}function x(e){e.target.removeEventListener(`dispose`,x);for(let t in l){let n=l[t],r=e.target.uuid;r in n&&(n[r].dispose(),delete n[r])}}}function Mm(e,t){function n(){let t=!1,n=new Es,r=null,i=new Es(0,0,0,0);return{setMask:function(n){r!==n&&!t&&(e.colorMask(n,n,n,n),r=n)},setLocked:function(e){t=e},setClear:function(t,r,a,o,s){s===!0&&(t*=o,r*=o,a*=o),n.set(t,r,a,o),i.equals(n)===!1&&(e.clearColor(t,r,a,o),i.copy(n))},reset:function(){t=!1,r=null,i.set(-1,0,0,0)}}}function r(){let n=!1,r=!1,i=null,a=null,o=null;return{setReversed:function(e){if(r!==e){let n=t.get(`EXT_clip_control`);e?n.clipControlEXT(n.LOWER_LEFT_EXT,n.ZERO_TO_ONE_EXT):n.clipControlEXT(n.LOWER_LEFT_EXT,n.NEGATIVE_ONE_TO_ONE_EXT),r=e;let i=o;o=null,this.setClear(i)}},getReversed:function(){return r},setTest:function(t){t?ae(e.DEPTH_TEST):oe(e.DEPTH_TEST)},setMask:function(t){i!==t&&!n&&(e.depthMask(t),i=t)},setFunc:function(t){if(r&&(t=No[t]),a!==t){switch(t){case 0:e.depthFunc(e.NEVER);break;case 1:e.depthFunc(e.ALWAYS);break;case 2:e.depthFunc(e.LESS);break;case 3:e.depthFunc(e.LEQUAL);break;case 4:e.depthFunc(e.EQUAL);break;case 5:e.depthFunc(e.GEQUAL);break;case 6:e.depthFunc(e.GREATER);break;case 7:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}a=t}},setLocked:function(e){n=e},setClear:function(t){o!==t&&(o=t,r&&(t=1-t),e.clearDepth(t))},reset:function(){n=!1,i=null,a=null,o=null,r=!1}}}function i(){let t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null;return{setTest:function(n){t||(n?ae(e.STENCIL_TEST):oe(e.STENCIL_TEST))},setMask:function(r){n!==r&&!t&&(e.stencilMask(r),n=r)},setFunc:function(t,n,o){(r!==t||i!==n||a!==o)&&(e.stencilFunc(t,n,o),r=t,i=n,a=o)},setOp:function(t,n,r){(o!==t||s!==n||c!==r)&&(e.stencilOp(t,n,r),o=t,s=n,c=r)},setLocked:function(e){t=e},setClear:function(t){l!==t&&(e.clearStencil(t),l=t)},reset:function(){t=!1,n=null,r=null,i=null,a=null,o=null,s=null,c=null,l=null}}}let a=new n,o=new r,s=new i,c=new WeakMap,l=new WeakMap,u={},d={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new X(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,M=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS),N=!1,P=0,F=e.getParameter(e.VERSION);F.indexOf(`WebGL`)===-1?F.indexOf(`OpenGL ES`)!==-1&&(P=parseFloat(/^OpenGL ES (\d)/.exec(F)[1]),N=P>=2):(P=parseFloat(/^WebGL (\d)/.exec(F)[1]),N=P>=1);let I=null,ee={},L=e.getParameter(e.SCISSOR_BOX),te=e.getParameter(e.VIEWPORT),R=new Es().fromArray(L),ne=new Es().fromArray(te);function re(t,n,r,i){let a=new Uint8Array(4),o=e.createTexture();e.bindTexture(t,o),e.texParameteri(t,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(t,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let o=0;o<r;o++)t===e.TEXTURE_3D||t===e.TEXTURE_2D_ARRAY?e.texImage3D(n,0,e.RGBA,1,1,i,0,e.RGBA,e.UNSIGNED_BYTE,a):e.texImage2D(n+o,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,a);return o}let ie={};ie[e.TEXTURE_2D]=re(e.TEXTURE_2D,e.TEXTURE_2D,1),ie[e.TEXTURE_CUBE_MAP]=re(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),ie[e.TEXTURE_2D_ARRAY]=re(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),ie[e.TEXTURE_3D]=re(e.TEXTURE_3D,e.TEXTURE_3D,1,1),a.setClear(0,0,0,1),o.setClear(1),s.setClear(0),ae(e.DEPTH_TEST),o.setFunc(3),me(!1),he(1),ae(e.CULL_FACE),fe(0);function ae(t){u[t]!==!0&&(e.enable(t),u[t]=!0)}function oe(t){u[t]!==!1&&(e.disable(t),u[t]=!1)}function se(t,n){return f[t]===n?!1:(e.bindFramebuffer(t,n),f[t]=n,t===e.DRAW_FRAMEBUFFER&&(f[e.FRAMEBUFFER]=n),t===e.FRAMEBUFFER&&(f[e.DRAW_FRAMEBUFFER]=n),!0)}function ce(t,n){let r=m,i=!1;if(t){r=p.get(n),r===void 0&&(r=[],p.set(n,r));let a=t.textures;if(r.length!==a.length||r[0]!==e.COLOR_ATTACHMENT0){for(let t=0,n=a.length;t<n;t++)r[t]=e.COLOR_ATTACHMENT0+t;r.length=a.length,i=!0}}else r[0]!==e.BACK&&(r[0]=e.BACK,i=!0);i&&e.drawBuffers(r)}function le(t){return h===t?!1:(e.useProgram(t),h=t,!0)}let ue={100:e.FUNC_ADD,101:e.FUNC_SUBTRACT,102:e.FUNC_REVERSE_SUBTRACT};ue[103]=e.MIN,ue[104]=e.MAX;let de={200:e.ZERO,201:e.ONE,202:e.SRC_COLOR,204:e.SRC_ALPHA,210:e.SRC_ALPHA_SATURATE,208:e.DST_COLOR,206:e.DST_ALPHA,203:e.ONE_MINUS_SRC_COLOR,205:e.ONE_MINUS_SRC_ALPHA,209:e.ONE_MINUS_DST_COLOR,207:e.ONE_MINUS_DST_ALPHA,211:e.CONSTANT_COLOR,212:e.ONE_MINUS_CONSTANT_COLOR,213:e.CONSTANT_ALPHA,214:e.ONE_MINUS_CONSTANT_ALPHA};function fe(t,n,r,i,a,o,s,c,l,u){if(t===0){g===!0&&(oe(e.BLEND),g=!1);return}if(g===!1&&(ae(e.BLEND),g=!0),t!==5){if(t!==_||u!==E){if((v!==100||x!==100)&&(e.blendEquation(e.FUNC_ADD),v=100,x=100),u)switch(t){case 1:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFunc(e.ONE,e.ONE);break;case 3:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case 4:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:K(`WebGLState: Invalid blending: `,t);break}else switch(t){case 1:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case 2:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case 3:K(`WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true`);break;case 4:K(`WebGLState: MultiplyBlending requires material.premultipliedAlpha = true`);break;default:K(`WebGLState: Invalid blending: `,t);break}y=null,b=null,S=null,C=null,w.set(0,0,0),T=0,_=t,E=u}return}a||=n,o||=r,s||=i,(n!==v||a!==x)&&(e.blendEquationSeparate(ue[n],ue[a]),v=n,x=a),(r!==y||i!==b||o!==S||s!==C)&&(e.blendFuncSeparate(de[r],de[i],de[o],de[s]),y=r,b=i,S=o,C=s),(c.equals(w)===!1||l!==T)&&(e.blendColor(c.r,c.g,c.b,l),w.copy(c),T=l),_=t,E=!1}function pe(t,n){t.side===2?oe(e.CULL_FACE):ae(e.CULL_FACE);let r=t.side===1;n&&(r=!r),me(r),t.blending===1&&t.transparent===!1?fe(0):fe(t.blending,t.blendEquation,t.blendSrc,t.blendDst,t.blendEquationAlpha,t.blendSrcAlpha,t.blendDstAlpha,t.blendColor,t.blendAlpha,t.premultipliedAlpha),o.setFunc(t.depthFunc),o.setTest(t.depthTest),o.setMask(t.depthWrite),a.setMask(t.colorWrite);let i=t.stencilWrite;s.setTest(i),i&&(s.setMask(t.stencilWriteMask),s.setFunc(t.stencilFunc,t.stencilRef,t.stencilFuncMask),s.setOp(t.stencilFail,t.stencilZFail,t.stencilZPass)),ge(t.polygonOffset,t.polygonOffsetFactor,t.polygonOffsetUnits),t.alphaToCoverage===!0?ae(e.SAMPLE_ALPHA_TO_COVERAGE):oe(e.SAMPLE_ALPHA_TO_COVERAGE)}function me(t){D!==t&&(t?e.frontFace(e.CW):e.frontFace(e.CCW),D=t)}function he(t){t===0?oe(e.CULL_FACE):(ae(e.CULL_FACE),t!==O&&(t===1?e.cullFace(e.BACK):t===2?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))),O=t}function z(t){t!==k&&(N&&e.lineWidth(t),k=t)}function ge(t,n,r){t?(ae(e.POLYGON_OFFSET_FILL),(A!==n||j!==r)&&(A=n,j=r,o.getReversed()&&(n=-n),e.polygonOffset(n,r))):oe(e.POLYGON_OFFSET_FILL)}function _e(t){t?ae(e.SCISSOR_TEST):oe(e.SCISSOR_TEST)}function ve(t){t===void 0&&(t=e.TEXTURE0+M-1),I!==t&&(e.activeTexture(t),I=t)}function B(t,n,r){r===void 0&&(r=I===null?e.TEXTURE0+M-1:I);let i=ee[r];i===void 0&&(i={type:void 0,texture:void 0},ee[r]=i),(i.type!==t||i.texture!==n)&&(I!==r&&(e.activeTexture(r),I=r),e.bindTexture(t,n||ie[t]),i.type=t,i.texture=n)}function ye(){let t=ee[I];t!==void 0&&t.type!==void 0&&(e.bindTexture(t.type,null),t.type=void 0,t.texture=void 0)}function V(){try{e.compressedTexImage2D(...arguments)}catch(e){K(`WebGLState:`,e)}}function H(){try{e.compressedTexImage3D(...arguments)}catch(e){K(`WebGLState:`,e)}}function be(){try{e.texSubImage2D(...arguments)}catch(e){K(`WebGLState:`,e)}}function xe(){try{e.texSubImage3D(...arguments)}catch(e){K(`WebGLState:`,e)}}function Se(){try{e.compressedTexSubImage2D(...arguments)}catch(e){K(`WebGLState:`,e)}}function Ce(){try{e.compressedTexSubImage3D(...arguments)}catch(e){K(`WebGLState:`,e)}}function we(){try{e.texStorage2D(...arguments)}catch(e){K(`WebGLState:`,e)}}function Te(){try{e.texStorage3D(...arguments)}catch(e){K(`WebGLState:`,e)}}function Ee(){try{e.texImage2D(...arguments)}catch(e){K(`WebGLState:`,e)}}function De(){try{e.texImage3D(...arguments)}catch(e){K(`WebGLState:`,e)}}function Oe(t){return d[t]===void 0?e.getParameter(t):d[t]}function ke(t,n){d[t]!==n&&(e.pixelStorei(t,n),d[t]=n)}function Ae(t){R.equals(t)===!1&&(e.scissor(t.x,t.y,t.z,t.w),R.copy(t))}function je(t){ne.equals(t)===!1&&(e.viewport(t.x,t.y,t.z,t.w),ne.copy(t))}function Me(t,n){let r=l.get(n);r===void 0&&(r=new WeakMap,l.set(n,r));let i=r.get(t);i===void 0&&(i=e.getUniformBlockIndex(n,t.name),r.set(t,i))}function Ne(t,n){let r=l.get(n).get(t);c.get(n)!==r&&(e.uniformBlockBinding(n,r,t.__bindingPointIndex),c.set(n,r))}function Pe(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),o.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),e.pixelStorei(e.PACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_ALIGNMENT,4),e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,!1),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,e.BROWSER_DEFAULT_WEBGL),e.pixelStorei(e.PACK_ROW_LENGTH,0),e.pixelStorei(e.PACK_SKIP_PIXELS,0),e.pixelStorei(e.PACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_ROW_LENGTH,0),e.pixelStorei(e.UNPACK_IMAGE_HEIGHT,0),e.pixelStorei(e.UNPACK_SKIP_PIXELS,0),e.pixelStorei(e.UNPACK_SKIP_ROWS,0),e.pixelStorei(e.UNPACK_SKIP_IMAGES,0),u={},d={},I=null,ee={},f={},p=new WeakMap,m=[],h=null,g=!1,_=null,v=null,y=null,b=null,x=null,S=null,C=null,w=new X(0,0,0),T=0,E=!1,D=null,O=null,k=null,A=null,j=null,R.set(0,0,e.canvas.width,e.canvas.height),ne.set(0,0,e.canvas.width,e.canvas.height),a.reset(),o.reset(),s.reset()}return{buffers:{color:a,depth:o,stencil:s},enable:ae,disable:oe,bindFramebuffer:se,drawBuffers:ce,useProgram:le,setBlending:fe,setMaterial:pe,setFlipSided:me,setCullFace:he,setLineWidth:z,setPolygonOffset:ge,setScissorTest:_e,activeTexture:ve,bindTexture:B,unbindTexture:ye,compressedTexImage2D:V,compressedTexImage3D:H,texImage2D:Ee,texImage3D:De,pixelStorei:ke,getParameter:Oe,updateUBOMapping:Me,uniformBlockBinding:Ne,texStorage2D:we,texStorage3D:Te,texSubImage2D:be,texSubImage3D:xe,compressedTexSubImage2D:Se,compressedTexSubImage3D:Ce,scissor:Ae,viewport:je,reset:Pe}}function Nm(e,t,n,r,i,a,o){let s=t.has(`WEBGL_multisampled_render_to_texture`)?t.get(`WEBGL_multisampled_render_to_texture`):null,c=typeof navigator>`u`?!1:/OculusBrowser/g.test(navigator.userAgent),l=new q,u=new WeakMap,d=new Set,f,p=new WeakMap,m=!1;try{m=typeof OffscreenCanvas<`u`&&new OffscreenCanvas(1,1).getContext(`2d`)!==null}catch{}function h(e,t){return m?new OffscreenCanvas(e,t):To(`canvas`)}function g(e,t,n){let r=1,i=V(e);if((i.width>n||i.height>n)&&(r=n/Math.max(i.width,i.height)),r<1)if(typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<`u`&&e instanceof HTMLCanvasElement||typeof ImageBitmap<`u`&&e instanceof ImageBitmap||typeof VideoFrame<`u`&&e instanceof VideoFrame){let n=Math.floor(r*i.width),a=Math.floor(r*i.height);f===void 0&&(f=h(n,a));let o=t?h(n,a):f;return o.width=n,o.height=a,o.getContext(`2d`).drawImage(e,0,0,n,a),G(`WebGLRenderer: Texture has been resized from (`+i.width+`x`+i.height+`) to (`+n+`x`+a+`).`),o}else return`data`in e&&G(`WebGLRenderer: Image in DataTexture is too big (`+i.width+`x`+i.height+`).`),e;return e}function _(e){return e.generateMipmaps}function v(t){e.generateMipmap(t)}function y(t){return t.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:t.isWebGL3DRenderTarget?e.TEXTURE_3D:t.isWebGLArrayRenderTarget||t.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function b(n,r,i,a,o,s=!1){if(n!==null){if(e[n]!==void 0)return e[n];G(`WebGLRenderer: Attempt to use non-existing WebGL internal format '`+n+`'`)}let c;a&&(c=t.get(`EXT_texture_norm16`),c||G(`WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension`));let l=r;if(r===e.RED&&(i===e.FLOAT&&(l=e.R32F),i===e.HALF_FLOAT&&(l=e.R16F),i===e.UNSIGNED_BYTE&&(l=e.R8),i===e.UNSIGNED_SHORT&&c&&(l=c.R16_EXT),i===e.SHORT&&c&&(l=c.R16_SNORM_EXT)),r===e.RED_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.R8UI),i===e.UNSIGNED_SHORT&&(l=e.R16UI),i===e.UNSIGNED_INT&&(l=e.R32UI),i===e.BYTE&&(l=e.R8I),i===e.SHORT&&(l=e.R16I),i===e.INT&&(l=e.R32I)),r===e.RG&&(i===e.FLOAT&&(l=e.RG32F),i===e.HALF_FLOAT&&(l=e.RG16F),i===e.UNSIGNED_BYTE&&(l=e.RG8),i===e.UNSIGNED_SHORT&&c&&(l=c.RG16_EXT),i===e.SHORT&&c&&(l=c.RG16_SNORM_EXT)),r===e.RG_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RG8UI),i===e.UNSIGNED_SHORT&&(l=e.RG16UI),i===e.UNSIGNED_INT&&(l=e.RG32UI),i===e.BYTE&&(l=e.RG8I),i===e.SHORT&&(l=e.RG16I),i===e.INT&&(l=e.RG32I)),r===e.RGB_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGB8UI),i===e.UNSIGNED_SHORT&&(l=e.RGB16UI),i===e.UNSIGNED_INT&&(l=e.RGB32UI),i===e.BYTE&&(l=e.RGB8I),i===e.SHORT&&(l=e.RGB16I),i===e.INT&&(l=e.RGB32I)),r===e.RGBA_INTEGER&&(i===e.UNSIGNED_BYTE&&(l=e.RGBA8UI),i===e.UNSIGNED_SHORT&&(l=e.RGBA16UI),i===e.UNSIGNED_INT&&(l=e.RGBA32UI),i===e.BYTE&&(l=e.RGBA8I),i===e.SHORT&&(l=e.RGBA16I),i===e.INT&&(l=e.RGBA32I)),r===e.RGB&&(i===e.UNSIGNED_SHORT&&c&&(l=c.RGB16_EXT),i===e.SHORT&&c&&(l=c.RGB16_SNORM_EXT),i===e.UNSIGNED_INT_5_9_9_9_REV&&(l=e.RGB9_E5),i===e.UNSIGNED_INT_10F_11F_11F_REV&&(l=e.R11F_G11F_B10F)),r===e.RGBA){let t=s?vo:hs.getTransfer(o);i===e.FLOAT&&(l=e.RGBA32F),i===e.HALF_FLOAT&&(l=e.RGBA16F),i===e.UNSIGNED_BYTE&&(l=t===`srgb`?e.SRGB8_ALPHA8:e.RGBA8),i===e.UNSIGNED_SHORT&&c&&(l=c.RGBA16_EXT),i===e.SHORT&&c&&(l=c.RGBA16_SNORM_EXT),i===e.UNSIGNED_SHORT_4_4_4_4&&(l=e.RGBA4),i===e.UNSIGNED_SHORT_5_5_5_1&&(l=e.RGB5_A1)}return(l===e.R16F||l===e.R32F||l===e.RG16F||l===e.RG32F||l===e.RGBA16F||l===e.RGBA32F)&&t.get(`EXT_color_buffer_float`),l}function x(t,n){let r;return t?n===null||n===1014||n===1020?r=e.DEPTH24_STENCIL8:n===1015?r=e.DEPTH32F_STENCIL8:n===1012&&(r=e.DEPTH24_STENCIL8,G(`DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.`)):n===null||n===1014||n===1020?r=e.DEPTH_COMPONENT24:n===1015?r=e.DEPTH_COMPONENT32F:n===1012&&(r=e.DEPTH_COMPONENT16),r}function S(e,t){return _(e)===!0||e.isFramebufferTexture&&e.minFilter!==1003&&e.minFilter!==1006?Math.log2(Math.max(t.width,t.height))+1:e.mipmaps!==void 0&&e.mipmaps.length>0?e.mipmaps.length:e.isCompressedTexture&&Array.isArray(e.image)?t.mipmaps.length:1}function C(e){let t=e.target;t.removeEventListener(`dispose`,C),T(t),t.isVideoTexture&&u.delete(t),t.isHTMLTexture&&d.delete(t)}function w(e){let t=e.target;t.removeEventListener(`dispose`,w),D(t)}function T(e){let t=r.get(e);if(t.__webglInit===void 0)return;let n=e.source,i=p.get(n);if(i){let r=i[t.__cacheKey];r.usedTimes--,r.usedTimes===0&&E(e),Object.keys(i).length===0&&p.delete(n)}r.remove(e)}function E(t){let n=r.get(t);e.deleteTexture(n.__webglTexture);let i=t.source,a=p.get(i);delete a[n.__cacheKey],o.memory.textures--}function D(t){let n=r.get(t);if(t.depthTexture&&(t.depthTexture.dispose(),r.remove(t.depthTexture)),t.isWebGLCubeRenderTarget)for(let t=0;t<6;t++){if(Array.isArray(n.__webglFramebuffer[t]))for(let r=0;r<n.__webglFramebuffer[t].length;r++)e.deleteFramebuffer(n.__webglFramebuffer[t][r]);else e.deleteFramebuffer(n.__webglFramebuffer[t]);n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer[t])}else{if(Array.isArray(n.__webglFramebuffer))for(let t=0;t<n.__webglFramebuffer.length;t++)e.deleteFramebuffer(n.__webglFramebuffer[t]);else e.deleteFramebuffer(n.__webglFramebuffer);if(n.__webglDepthbuffer&&e.deleteRenderbuffer(n.__webglDepthbuffer),n.__webglMultisampledFramebuffer&&e.deleteFramebuffer(n.__webglMultisampledFramebuffer),n.__webglColorRenderbuffer)for(let t=0;t<n.__webglColorRenderbuffer.length;t++)n.__webglColorRenderbuffer[t]&&e.deleteRenderbuffer(n.__webglColorRenderbuffer[t]);n.__webglDepthRenderbuffer&&e.deleteRenderbuffer(n.__webglDepthRenderbuffer)}let i=t.textures;for(let t=0,n=i.length;t<n;t++){let n=r.get(i[t]);n.__webglTexture&&(e.deleteTexture(n.__webglTexture),o.memory.textures--),r.remove(i[t])}r.remove(t)}let O=0;function k(){O=0}function A(){return O}function j(e){O=e}function M(){let e=O;return e>=i.maxTextures&&G(`WebGLTextures: Trying to use `+e+` texture units while this GPU supports only `+i.maxTextures),O+=1,e}function N(e){let t=[];return t.push(e.wrapS),t.push(e.wrapT),t.push(e.wrapR||0),t.push(e.magFilter),t.push(e.minFilter),t.push(e.anisotropy),t.push(e.internalFormat),t.push(e.format),t.push(e.type),t.push(e.generateMipmaps),t.push(e.premultiplyAlpha),t.push(e.flipY),t.push(e.unpackAlignment),t.push(e.colorSpace),t.join()}function P(t,i){let a=r.get(t);if(t.isVideoTexture&&B(t),t.isRenderTargetTexture===!1&&t.isExternalTexture!==!0&&t.version>0&&a.__version!==t.version){let e=t.image;if(e===null)G(`WebGLRenderer: Texture marked for update but no image data found.`);else if(e.complete===!1)G(`WebGLRenderer: Texture marked for update but image is incomplete`);else{oe(a,t,i);return}}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D,a.__webglTexture,e.TEXTURE0+i)}function F(t,i){let a=r.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version){oe(a,t,i);return}else t.isExternalTexture&&(a.__webglTexture=t.sourceTexture?t.sourceTexture:null);n.bindTexture(e.TEXTURE_2D_ARRAY,a.__webglTexture,e.TEXTURE0+i)}function I(t,i){let a=r.get(t);if(t.isRenderTargetTexture===!1&&t.version>0&&a.__version!==t.version){oe(a,t,i);return}n.bindTexture(e.TEXTURE_3D,a.__webglTexture,e.TEXTURE0+i)}function ee(t,i){let a=r.get(t);if(t.isCubeDepthTexture!==!0&&t.version>0&&a.__version!==t.version){se(a,t,i);return}n.bindTexture(e.TEXTURE_CUBE_MAP,a.__webglTexture,e.TEXTURE0+i)}let L={[qi]:e.REPEAT,[Ji]:e.CLAMP_TO_EDGE,[Yi]:e.MIRRORED_REPEAT},te={[Xi]:e.NEAREST,[Zi]:e.NEAREST_MIPMAP_NEAREST,[Qi]:e.NEAREST_MIPMAP_LINEAR,[$i]:e.LINEAR,[ea]:e.LINEAR_MIPMAP_NEAREST,[ta]:e.LINEAR_MIPMAP_LINEAR},R={512:e.NEVER,519:e.ALWAYS,513:e.LESS,515:e.LEQUAL,514:e.EQUAL,518:e.GEQUAL,516:e.GREATER,517:e.NOTEQUAL};function ne(n,a){if(a.type===1015&&t.has(`OES_texture_float_linear`)===!1&&(a.magFilter===1006||a.magFilter===1007||a.magFilter===1005||a.magFilter===1008||a.minFilter===1006||a.minFilter===1007||a.minFilter===1005||a.minFilter===1008)&&G(`WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.`),e.texParameteri(n,e.TEXTURE_WRAP_S,L[a.wrapS]),e.texParameteri(n,e.TEXTURE_WRAP_T,L[a.wrapT]),(n===e.TEXTURE_3D||n===e.TEXTURE_2D_ARRAY)&&e.texParameteri(n,e.TEXTURE_WRAP_R,L[a.wrapR]),e.texParameteri(n,e.TEXTURE_MAG_FILTER,te[a.magFilter]),e.texParameteri(n,e.TEXTURE_MIN_FILTER,te[a.minFilter]),a.compareFunction&&(e.texParameteri(n,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(n,e.TEXTURE_COMPARE_FUNC,R[a.compareFunction])),t.has(`EXT_texture_filter_anisotropic`)===!0){if(a.magFilter===1003||a.minFilter!==1005&&a.minFilter!==1008||a.type===1015&&t.has(`OES_texture_float_linear`)===!1)return;if(a.anisotropy>1||r.get(a).__currentAnisotropy){let o=t.get(`EXT_texture_filter_anisotropic`);e.texParameterf(n,o.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(a.anisotropy,i.getMaxAnisotropy())),r.get(a).__currentAnisotropy=a.anisotropy}}}function re(t,n){let r=!1;t.__webglInit===void 0&&(t.__webglInit=!0,n.addEventListener(`dispose`,C));let i=n.source,a=p.get(i);a===void 0&&(a={},p.set(i,a));let s=N(n);if(s!==t.__cacheKey){a[s]===void 0&&(a[s]={texture:e.createTexture(),usedTimes:0},o.memory.textures++,r=!0),a[s].usedTimes++;let i=a[t.__cacheKey];i!==void 0&&(a[t.__cacheKey].usedTimes--,i.usedTimes===0&&E(n)),t.__cacheKey=s,t.__webglTexture=a[s].texture}return r}function ie(e,t,n){return Math.floor(Math.floor(e/n)/t)}function ae(t,r,i,a){let o=t.updateRanges;if(o.length===0)n.texSubImage2D(e.TEXTURE_2D,0,0,0,r.width,r.height,i,a,r.data);else{o.sort((e,t)=>e.start-t.start);let s=0;for(let e=1;e<o.length;e++){let t=o[s],n=o[e],i=t.start+t.count,a=ie(n.start,r.width,4),c=ie(t.start,r.width,4);n.start<=i+1&&a===c&&ie(n.start+n.count-1,r.width,4)===a?t.count=Math.max(t.count,n.start+n.count-t.start):(++s,o[s]=n)}o.length=s+1;let c=n.getParameter(e.UNPACK_ROW_LENGTH),l=n.getParameter(e.UNPACK_SKIP_PIXELS),u=n.getParameter(e.UNPACK_SKIP_ROWS);n.pixelStorei(e.UNPACK_ROW_LENGTH,r.width);for(let t=0,s=o.length;t<s;t++){let s=o[t],c=Math.floor(s.start/4),l=Math.ceil(s.count/4),u=c%r.width,d=Math.floor(c/r.width),f=l;n.pixelStorei(e.UNPACK_SKIP_PIXELS,u),n.pixelStorei(e.UNPACK_SKIP_ROWS,d),n.texSubImage2D(e.TEXTURE_2D,0,u,d,f,1,i,a,r.data)}t.clearUpdateRanges(),n.pixelStorei(e.UNPACK_ROW_LENGTH,c),n.pixelStorei(e.UNPACK_SKIP_PIXELS,l),n.pixelStorei(e.UNPACK_SKIP_ROWS,u)}}function oe(t,o,s){let c=e.TEXTURE_2D;(o.isDataArrayTexture||o.isCompressedArrayTexture)&&(c=e.TEXTURE_2D_ARRAY),o.isData3DTexture&&(c=e.TEXTURE_3D);let l=re(t,o),u=o.source;n.bindTexture(c,t.__webglTexture,e.TEXTURE0+s);let f=r.get(u);if(u.version!==f.__version||l===!0){if(n.activeTexture(e.TEXTURE0+s),!(typeof ImageBitmap<`u`&&o.image instanceof ImageBitmap)){let t=hs.getPrimaries(hs.workingColorSpace),r=o.colorSpace===``?null:hs.getPrimaries(o.colorSpace),i=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,i)}n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment);let t=g(o.image,!1,i.maxTextureSize);t=ye(o,t);let r=a.convert(o.format,o.colorSpace),p=a.convert(o.type),m=b(o.internalFormat,r,p,o.normalized,o.colorSpace,o.isVideoTexture);ne(c,o);let h,y=o.mipmaps,C=o.isVideoTexture!==!0,w=f.__version===void 0||l===!0,T=u.dataReady,E=S(o,t);if(o.isDepthTexture)m=x(o.format===ya,o.type),w&&(C?n.texStorage2D(e.TEXTURE_2D,1,m,t.width,t.height):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,null));else if(o.isDataTexture)if(y.length>0){C&&w&&n.texStorage2D(e.TEXTURE_2D,E,m,y[0].width,y[0].height);for(let t=0,i=y.length;t<i;t++)h=y[t],C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data);o.generateMipmaps=!1}else C?(w&&n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height),T&&ae(o,t,r,p)):n.texImage2D(e.TEXTURE_2D,0,m,t.width,t.height,0,r,p,t.data);else if(o.isCompressedTexture)if(o.isCompressedArrayTexture){C&&w&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,y[0].width,y[0].height,t.depth);for(let i=0,a=y.length;i<a;i++)if(h=y[i],o.format!==1023)if(r!==null)if(C){if(T)if(o.layerUpdates.size>0){let t=Dd(h.width,h.height,o.format,o.type);for(let a of o.layerUpdates){let o=h.data.subarray(a*t/h.data.BYTES_PER_ELEMENT,(a+1)*t/h.data.BYTES_PER_ELEMENT);n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,a,h.width,h.height,1,r,o)}o.clearLayerUpdates()}else n.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,h.data)}else n.compressedTexImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,h.data,0,0);else G(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`);else C?T&&n.texSubImage3D(e.TEXTURE_2D_ARRAY,i,0,0,0,h.width,h.height,t.depth,r,p,h.data):n.texImage3D(e.TEXTURE_2D_ARRAY,i,m,h.width,h.height,t.depth,0,r,p,h.data)}else{C&&w&&n.texStorage2D(e.TEXTURE_2D,E,m,y[0].width,y[0].height);for(let t=0,i=y.length;t<i;t++)h=y[t],o.format===1023?C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,p,h.data):n.texImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,r,p,h.data):r===null?G(`WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()`):C?T&&n.compressedTexSubImage2D(e.TEXTURE_2D,t,0,0,h.width,h.height,r,h.data):n.compressedTexImage2D(e.TEXTURE_2D,t,m,h.width,h.height,0,h.data)}else if(o.isDataArrayTexture)if(C){if(w&&n.texStorage3D(e.TEXTURE_2D_ARRAY,E,m,t.width,t.height,t.depth),T)if(o.layerUpdates.size>0){let i=Dd(t.width,t.height,o.format,o.type);for(let a of o.layerUpdates){let o=t.data.subarray(a*i/t.data.BYTES_PER_ELEMENT,(a+1)*i/t.data.BYTES_PER_ELEMENT);n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,a,t.width,t.height,1,r,p,o)}o.clearLayerUpdates()}else n.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)}else n.texImage3D(e.TEXTURE_2D_ARRAY,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isData3DTexture)C?(w&&n.texStorage3D(e.TEXTURE_3D,E,m,t.width,t.height,t.depth),T&&n.texSubImage3D(e.TEXTURE_3D,0,0,0,0,t.width,t.height,t.depth,r,p,t.data)):n.texImage3D(e.TEXTURE_3D,0,m,t.width,t.height,t.depth,0,r,p,t.data);else if(o.isFramebufferTexture){if(w)if(C)n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height);else{let i=t.width,a=t.height;for(let t=0;t<E;t++)n.texImage2D(e.TEXTURE_2D,t,m,i,a,0,r,p,null),i>>=1,a>>=1}}else if(o.isHTMLTexture){if(`texElementImage2D`in e){let n=e.canvas;if(n.hasAttribute(`layoutsubtree`)||n.setAttribute(`layoutsubtree`,`true`),t.parentNode!==n){n.appendChild(t),d.add(o),n.onpaint=e=>{let t=e.changedElements;for(let e of d)t.includes(e.image)&&(e.needsUpdate=!0)},n.requestPaint();return}let r=e.RGBA,i=e.RGBA,a=e.UNSIGNED_BYTE;e.texElementImage2D(e.TEXTURE_2D,0,r,i,a,t),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE)}}else if(y.length>0){if(C&&w){let t=V(y[0]);n.texStorage2D(e.TEXTURE_2D,E,m,t.width,t.height)}for(let t=0,i=y.length;t<i;t++)h=y[t],C?T&&n.texSubImage2D(e.TEXTURE_2D,t,0,0,r,p,h):n.texImage2D(e.TEXTURE_2D,t,m,r,p,h);o.generateMipmaps=!1}else if(C){if(w){let r=V(t);n.texStorage2D(e.TEXTURE_2D,E,m,r.width,r.height)}T&&n.texSubImage2D(e.TEXTURE_2D,0,0,0,r,p,t)}else n.texImage2D(e.TEXTURE_2D,0,m,r,p,t);_(o)&&v(c),f.__version=u.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function se(t,o,s){if(o.image.length!==6)return;let c=re(t,o),l=o.source;n.bindTexture(e.TEXTURE_CUBE_MAP,t.__webglTexture,e.TEXTURE0+s);let u=r.get(l);if(l.version!==u.__version||c===!0){n.activeTexture(e.TEXTURE0+s);let t=hs.getPrimaries(hs.workingColorSpace),r=o.colorSpace===``?null:hs.getPrimaries(o.colorSpace),d=o.colorSpace===``||t===r?e.NONE:e.BROWSER_DEFAULT_WEBGL;n.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,o.flipY),n.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,o.premultiplyAlpha),n.pixelStorei(e.UNPACK_ALIGNMENT,o.unpackAlignment),n.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,d);let f=o.isCompressedTexture||o.image[0].isCompressedTexture,p=o.image[0]&&o.image[0].isDataTexture,m=[];for(let e=0;e<6;e++)!f&&!p?m[e]=g(o.image[e],!0,i.maxCubemapSize):m[e]=p?o.image[e].image:o.image[e],m[e]=ye(o,m[e]);let h=m[0],y=a.convert(o.format,o.colorSpace),x=a.convert(o.type),C=b(o.internalFormat,y,x,o.normalized,o.colorSpace),w=o.isVideoTexture!==!0,T=u.__version===void 0||c===!0,E=l.dataReady,D=S(o,h);ne(e.TEXTURE_CUBE_MAP,o);let O;if(f){w&&T&&n.texStorage2D(e.TEXTURE_CUBE_MAP,D,C,h.width,h.height);for(let t=0;t<6;t++){O=m[t].mipmaps;for(let r=0;r<O.length;r++){let i=O[r];o.format===1023?w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,y,x,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,C,i.width,i.height,0,y,x,i.data):y===null?G(`WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()`):w?E&&n.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,0,0,i.width,i.height,y,i.data):n.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r,C,i.width,i.height,0,i.data)}}}else{if(O=o.mipmaps,w&&T){O.length>0&&D++;let t=V(m[0]);n.texStorage2D(e.TEXTURE_CUBE_MAP,D,C,t.width,t.height)}for(let t=0;t<6;t++)if(p){w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,m[t].width,m[t].height,y,x,m[t].data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,C,m[t].width,m[t].height,0,y,x,m[t].data);for(let r=0;r<O.length;r++){let i=O[r].image[t].image;w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,i.width,i.height,y,x,i.data):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,C,i.width,i.height,0,y,x,i.data)}}else{w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,0,0,y,x,m[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,0,C,y,x,m[t]);for(let r=0;r<O.length;r++){let i=O[r];w?E&&n.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,0,0,y,x,i.image[t]):n.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+t,r+1,C,y,x,i.image[t])}}}_(o)&&v(e.TEXTURE_CUBE_MAP),u.__version=l.version,o.onUpdate&&o.onUpdate(o)}t.__version=o.version}function ce(t,i,o,c,l,u){let d=a.convert(o.format,o.colorSpace),f=a.convert(o.type),p=b(o.internalFormat,d,f,o.normalized,o.colorSpace),m=r.get(i),h=r.get(o);if(h.__renderTarget=i,!m.__hasExternalTextures){let t=Math.max(1,i.width>>u),r=Math.max(1,i.height>>u);l===e.TEXTURE_3D||l===e.TEXTURE_2D_ARRAY?n.texImage3D(l,u,p,t,r,i.depth,0,d,f,null):n.texImage2D(l,u,p,t,r,0,d,f,null)}n.bindFramebuffer(e.FRAMEBUFFER,t),ve(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,c,l,h.__webglTexture,0,_e(i)):(l===e.TEXTURE_2D||l>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&l<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,c,l,h.__webglTexture,u),n.bindFramebuffer(e.FRAMEBUFFER,null)}function le(t,n,r){if(e.bindRenderbuffer(e.RENDERBUFFER,t),n.depthBuffer){let i=n.depthTexture,a=i&&i.isDepthTexture?i.type:null,o=x(n.stencilBuffer,a),c=n.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;ve(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,_e(n),o,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,_e(n),o,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,o,n.width,n.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,c,e.RENDERBUFFER,t)}else{let t=n.textures;for(let i=0;i<t.length;i++){let o=t[i],c=a.convert(o.format,o.colorSpace),l=a.convert(o.type),u=b(o.internalFormat,c,l,o.normalized,o.colorSpace);ve(n)?s.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,_e(n),u,n.width,n.height):r?e.renderbufferStorageMultisample(e.RENDERBUFFER,_e(n),u,n.width,n.height):e.renderbufferStorage(e.RENDERBUFFER,u,n.width,n.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function ue(t,i,o){let c=i.isWebGLCubeRenderTarget===!0;if(n.bindFramebuffer(e.FRAMEBUFFER,t),!(i.depthTexture&&i.depthTexture.isDepthTexture))throw Error(`renderTarget.depthTexture must be an instance of THREE.DepthTexture`);let l=r.get(i.depthTexture);if(l.__renderTarget=i,(!l.__webglTexture||i.depthTexture.image.width!==i.width||i.depthTexture.image.height!==i.height)&&(i.depthTexture.image.width=i.width,i.depthTexture.image.height=i.height,i.depthTexture.needsUpdate=!0),c){if(l.__webglInit===void 0&&(l.__webglInit=!0,i.depthTexture.addEventListener(`dispose`,C)),l.__webglTexture===void 0){l.__webglTexture=e.createTexture(),n.bindTexture(e.TEXTURE_CUBE_MAP,l.__webglTexture),ne(e.TEXTURE_CUBE_MAP,i.depthTexture);let t=a.convert(i.depthTexture.format),r=a.convert(i.depthTexture.type),o;i.depthTexture.format===1026?o=e.DEPTH_COMPONENT24:i.depthTexture.format===1027&&(o=e.DEPTH24_STENCIL8);for(let n=0;n<6;n++)e.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0,o,i.width,i.height,0,t,r,null)}}else P(i.depthTexture,0);let u=l.__webglTexture,d=_e(i),f=c?e.TEXTURE_CUBE_MAP_POSITIVE_X+o:e.TEXTURE_2D,p=i.depthTexture.format===1027?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;if(i.depthTexture.format===1026)ve(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else if(i.depthTexture.format===1027)ve(i)?s.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,p,f,u,0,d):e.framebufferTexture2D(e.FRAMEBUFFER,p,f,u,0);else throw Error(`Unknown depthTexture format`)}function de(t){let i=r.get(t),a=t.isWebGLCubeRenderTarget===!0;if(i.__boundDepthTexture!==t.depthTexture){let e=t.depthTexture;if(i.__depthDisposeCallback&&i.__depthDisposeCallback(),e){let t=()=>{delete i.__boundDepthTexture,delete i.__depthDisposeCallback,e.removeEventListener(`dispose`,t)};e.addEventListener(`dispose`,t),i.__depthDisposeCallback=t}i.__boundDepthTexture=e}if(t.depthTexture&&!i.__autoAllocateDepthBuffer)if(a)for(let e=0;e<6;e++)ue(i.__webglFramebuffer[e],t,e);else{let e=t.texture.mipmaps;e&&e.length>0?ue(i.__webglFramebuffer[0],t,0):ue(i.__webglFramebuffer,t,0)}else if(a){i.__webglDepthbuffer=[];for(let r=0;r<6;r++)if(n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[r]),i.__webglDepthbuffer[r]===void 0)i.__webglDepthbuffer[r]=e.createRenderbuffer(),le(i.__webglDepthbuffer[r],t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,a=i.__webglDepthbuffer[r];e.bindRenderbuffer(e.RENDERBUFFER,a),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,a)}}else{let r=t.texture.mipmaps;if(r&&r.length>0?n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer[0]):n.bindFramebuffer(e.FRAMEBUFFER,i.__webglFramebuffer),i.__webglDepthbuffer===void 0)i.__webglDepthbuffer=e.createRenderbuffer(),le(i.__webglDepthbuffer,t,!1);else{let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,r=i.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,r),e.framebufferRenderbuffer(e.FRAMEBUFFER,n,e.RENDERBUFFER,r)}}n.bindFramebuffer(e.FRAMEBUFFER,null)}function fe(t,n,i){let a=r.get(t);n!==void 0&&ce(a.__webglFramebuffer,t,t.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),i!==void 0&&de(t)}function pe(t){let i=t.texture,s=r.get(t),c=r.get(i);t.addEventListener(`dispose`,w);let l=t.textures,u=t.isWebGLCubeRenderTarget===!0,d=l.length>1;if(d||(c.__webglTexture===void 0&&(c.__webglTexture=e.createTexture()),c.__version=i.version,o.memory.textures++),u){s.__webglFramebuffer=[];for(let t=0;t<6;t++)if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer[t]=[];for(let n=0;n<i.mipmaps.length;n++)s.__webglFramebuffer[t][n]=e.createFramebuffer()}else s.__webglFramebuffer[t]=e.createFramebuffer()}else{if(i.mipmaps&&i.mipmaps.length>0){s.__webglFramebuffer=[];for(let t=0;t<i.mipmaps.length;t++)s.__webglFramebuffer[t]=e.createFramebuffer()}else s.__webglFramebuffer=e.createFramebuffer();if(d)for(let t=0,n=l.length;t<n;t++){let n=r.get(l[t]);n.__webglTexture===void 0&&(n.__webglTexture=e.createTexture(),o.memory.textures++)}if(t.samples>0&&ve(t)===!1){s.__webglMultisampledFramebuffer=e.createFramebuffer(),s.__webglColorRenderbuffer=[],n.bindFramebuffer(e.FRAMEBUFFER,s.__webglMultisampledFramebuffer);for(let n=0;n<l.length;n++){let r=l[n];s.__webglColorRenderbuffer[n]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,s.__webglColorRenderbuffer[n]);let i=a.convert(r.format,r.colorSpace),o=a.convert(r.type),c=b(r.internalFormat,i,o,r.normalized,r.colorSpace,t.isXRRenderTarget===!0),u=_e(t);e.renderbufferStorageMultisample(e.RENDERBUFFER,u,c,t.width,t.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+n,e.RENDERBUFFER,s.__webglColorRenderbuffer[n])}e.bindRenderbuffer(e.RENDERBUFFER,null),t.depthBuffer&&(s.__webglDepthRenderbuffer=e.createRenderbuffer(),le(s.__webglDepthRenderbuffer,t,!0)),n.bindFramebuffer(e.FRAMEBUFFER,null)}}if(u){n.bindTexture(e.TEXTURE_CUBE_MAP,c.__webglTexture),ne(e.TEXTURE_CUBE_MAP,i);for(let n=0;n<6;n++)if(i.mipmaps&&i.mipmaps.length>0)for(let r=0;r<i.mipmaps.length;r++)ce(s.__webglFramebuffer[n][r],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,r);else ce(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+n,0);_(i)&&v(e.TEXTURE_CUBE_MAP),n.unbindTexture()}else if(d){for(let i=0,a=l.length;i<a;i++){let a=l[i],o=r.get(a),c=e.TEXTURE_2D;(t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(c=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(c,o.__webglTexture),ne(c,a),ce(s.__webglFramebuffer,t,a,e.COLOR_ATTACHMENT0+i,c,0),_(a)&&v(c)}n.unbindTexture()}else{let r=e.TEXTURE_2D;if((t.isWebGL3DRenderTarget||t.isWebGLArrayRenderTarget)&&(r=t.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),n.bindTexture(r,c.__webglTexture),ne(r,i),i.mipmaps&&i.mipmaps.length>0)for(let n=0;n<i.mipmaps.length;n++)ce(s.__webglFramebuffer[n],t,i,e.COLOR_ATTACHMENT0,r,n);else ce(s.__webglFramebuffer,t,i,e.COLOR_ATTACHMENT0,r,0);_(i)&&v(r),n.unbindTexture()}t.depthBuffer&&de(t)}function me(e){let t=e.textures;for(let i=0,a=t.length;i<a;i++){let a=t[i];if(_(a)){let t=y(e),i=r.get(a).__webglTexture;n.bindTexture(t,i),v(t),n.unbindTexture()}}}let he=[],z=[];function ge(t){if(t.samples>0){if(ve(t)===!1){let i=t.textures,a=t.width,o=t.height,s=e.COLOR_BUFFER_BIT,l=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,u=r.get(t),d=i.length>1;if(d)for(let t=0;t<i.length;t++)n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,null),n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,null,0);n.bindFramebuffer(e.READ_FRAMEBUFFER,u.__webglMultisampledFramebuffer);let f=t.texture.mipmaps;f&&f.length>0?n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer[0]):n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglFramebuffer);for(let n=0;n<i.length;n++){if(t.resolveDepthBuffer&&(t.depthBuffer&&(s|=e.DEPTH_BUFFER_BIT),t.stencilBuffer&&t.resolveStencilBuffer&&(s|=e.STENCIL_BUFFER_BIT)),d){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,u.__webglColorRenderbuffer[n]);let t=r.get(i[n]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,t,0)}e.blitFramebuffer(0,0,a,o,0,0,a,o,s,e.NEAREST),c===!0&&(he.length=0,z.length=0,he.push(e.COLOR_ATTACHMENT0+n),t.depthBuffer&&t.resolveDepthBuffer===!1&&(he.push(l),z.push(l),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,z)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,he))}if(n.bindFramebuffer(e.READ_FRAMEBUFFER,null),n.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),d)for(let t=0;t<i.length;t++){n.bindFramebuffer(e.FRAMEBUFFER,u.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.RENDERBUFFER,u.__webglColorRenderbuffer[t]);let a=r.get(i[t]).__webglTexture;n.bindFramebuffer(e.FRAMEBUFFER,u.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+t,e.TEXTURE_2D,a,0)}n.bindFramebuffer(e.DRAW_FRAMEBUFFER,u.__webglMultisampledFramebuffer)}else if(t.depthBuffer&&t.resolveDepthBuffer===!1&&c){let n=t.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[n])}}}function _e(e){return Math.min(i.maxSamples,e.samples)}function ve(e){let n=r.get(e);return e.samples>0&&t.has(`WEBGL_multisampled_render_to_texture`)===!0&&n.__useRenderToTexture!==!1}function B(e){let t=o.render.frame;u.get(e)!==t&&(u.set(e,t),e.update())}function ye(e,t){let n=e.colorSpace,r=e.format,i=e.type;return e.isCompressedTexture===!0||e.isVideoTexture===!0||n!==`srgb-linear`&&n!==``&&(hs.getTransfer(n)===`srgb`?(r!==1023||i!==1009)&&G(`WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.`):K(`WebGLTextures: Unsupported texture color space:`,n)),t}function V(e){return typeof HTMLImageElement<`u`&&e instanceof HTMLImageElement?(l.width=e.naturalWidth||e.width,l.height=e.naturalHeight||e.height):typeof VideoFrame<`u`&&e instanceof VideoFrame?(l.width=e.displayWidth,l.height=e.displayHeight):(l.width=e.width,l.height=e.height),l}this.allocateTextureUnit=M,this.resetTextureUnits=k,this.getTextureUnits=A,this.setTextureUnits=j,this.setTexture2D=P,this.setTexture2DArray=F,this.setTexture3D=I,this.setTextureCube=ee,this.rebindTextures=fe,this.setupRenderTarget=pe,this.updateRenderTargetMipmap=me,this.updateMultisampleRenderTarget=ge,this.setupDepthRenderbuffer=de,this.setupFrameBufferTexture=ce,this.useMultisampledRTT=ve,this.isReversedDepthBuffer=function(){return n.buffers.depth.getReversed()}}function Pm(e,t){function n(n,r=``){let i,a=hs.getTransfer(r);if(n===1009)return e.UNSIGNED_BYTE;if(n===1017)return e.UNSIGNED_SHORT_4_4_4_4;if(n===1018)return e.UNSIGNED_SHORT_5_5_5_1;if(n===35902)return e.UNSIGNED_INT_5_9_9_9_REV;if(n===35899)return e.UNSIGNED_INT_10F_11F_11F_REV;if(n===1010)return e.BYTE;if(n===1011)return e.SHORT;if(n===1012)return e.UNSIGNED_SHORT;if(n===1013)return e.INT;if(n===1014)return e.UNSIGNED_INT;if(n===1015)return e.FLOAT;if(n===1016)return e.HALF_FLOAT;if(n===1021)return e.ALPHA;if(n===1022)return e.RGB;if(n===1023)return e.RGBA;if(n===1026)return e.DEPTH_COMPONENT;if(n===1027)return e.DEPTH_STENCIL;if(n===1028)return e.RED;if(n===1029)return e.RED_INTEGER;if(n===1030)return e.RG;if(n===1031)return e.RG_INTEGER;if(n===1033)return e.RGBA_INTEGER;if(n===33776||n===33777||n===33778||n===33779)if(a===`srgb`)if(i=t.get(`WEBGL_compressed_texture_s3tc_srgb`),i!==null){if(n===33776)return i.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(i=t.get(`WEBGL_compressed_texture_s3tc`),i!==null){if(n===33776)return i.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===33777)return i.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===33778)return i.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===33779)return i.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===35840||n===35841||n===35842||n===35843)if(i=t.get(`WEBGL_compressed_texture_pvrtc`),i!==null){if(n===35840)return i.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===35841)return i.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===35842)return i.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===35843)return i.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===36196||n===37492||n===37496||n===37488||n===37489||n===37490||n===37491)if(i=t.get(`WEBGL_compressed_texture_etc`),i!==null){if(n===36196||n===37492)return a===`srgb`?i.COMPRESSED_SRGB8_ETC2:i.COMPRESSED_RGB8_ETC2;if(n===37496)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:i.COMPRESSED_RGBA8_ETC2_EAC;if(n===37488)return i.COMPRESSED_R11_EAC;if(n===37489)return i.COMPRESSED_SIGNED_R11_EAC;if(n===37490)return i.COMPRESSED_RG11_EAC;if(n===37491)return i.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===37808||n===37809||n===37810||n===37811||n===37812||n===37813||n===37814||n===37815||n===37816||n===37817||n===37818||n===37819||n===37820||n===37821)if(i=t.get(`WEBGL_compressed_texture_astc`),i!==null){if(n===37808)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:i.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===37809)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:i.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===37810)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:i.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===37811)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:i.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===37812)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:i.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===37813)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:i.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===37814)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:i.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===37815)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:i.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===37816)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:i.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===37817)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:i.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===37818)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:i.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===37819)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:i.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===37820)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:i.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===37821)return a===`srgb`?i.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:i.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===36492||n===36494||n===36495)if(i=t.get(`EXT_texture_compression_bptc`),i!==null){if(n===36492)return a===`srgb`?i.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:i.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===36494)return i.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===36495)return i.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===36283||n===36284||n===36285||n===36286)if(i=t.get(`EXT_texture_compression_rgtc`),i!==null){if(n===36283)return i.COMPRESSED_RED_RGTC1_EXT;if(n===36284)return i.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===36285)return i.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===36286)return i.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===1020?e.UNSIGNED_INT_24_8:e[n]===void 0?null:e[n]}return{convert:n}}var Fm=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Im=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`,Lm=class{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){let n=new su(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){let t=e.cameras[0].viewport,n=new vu({vertexShader:Fm,fragmentShader:Im,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Al(new lu(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}},Rm=class extends Po{constructor(e,t){super();let n=this,r=null,i=1,a=null,o=`local-floor`,s=1,c=null,l=null,u=null,d=null,f=null,p=null,m=typeof XRWebGLBinding<`u`,h=new Lm,g={},_=t.getContextAttributes(),v=null,y=null,b=[],x=[],S=new q,C=null,w=new Qu;w.viewport=new Es;let T=new Qu;T.viewport=new Es;let E=[w,T],D=new cd,O=null,k=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(e){let t=b[e];return t===void 0&&(t=new sc,b[e]=t),t.getTargetRaySpace()},this.getControllerGrip=function(e){let t=b[e];return t===void 0&&(t=new sc,b[e]=t),t.getGripSpace()},this.getHand=function(e){let t=b[e];return t===void 0&&(t=new sc,b[e]=t),t.getHandSpace()};function A(e){let t=x.indexOf(e.inputSource);if(t===-1)return;let n=b[t];n!==void 0&&(n.update(e.inputSource,e.frame,c||a),n.dispatchEvent({type:e.type,data:e.inputSource}))}function j(){r.removeEventListener(`select`,A),r.removeEventListener(`selectstart`,A),r.removeEventListener(`selectend`,A),r.removeEventListener(`squeeze`,A),r.removeEventListener(`squeezestart`,A),r.removeEventListener(`squeezeend`,A),r.removeEventListener(`end`,j),r.removeEventListener(`inputsourceschange`,M);for(let e=0;e<b.length;e++){let t=x[e];t!==null&&(x[e]=null,b[e].disconnect(t))}O=null,k=null,h.reset();for(let e in g)delete g[e];e.setRenderTarget(v),f=null,d=null,u=null,r=null,y=null,R.stop(),n.isPresenting=!1,e.setPixelRatio(C),e.setSize(S.width,S.height,!1),n.dispatchEvent({type:`sessionend`})}this.setFramebufferScaleFactor=function(e){i=e,n.isPresenting===!0&&G(`WebXRManager: Cannot change framebuffer scale while presenting.`)},this.setReferenceSpaceType=function(e){o=e,n.isPresenting===!0&&G(`WebXRManager: Cannot change reference space type while presenting.`)},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(e){c=e},this.getBaseLayer=function(){return d===null?f:d},this.getBinding=function(){return u===null&&m&&(u=new XRWebGLBinding(r,t)),u},this.getFrame=function(){return p},this.getSession=function(){return r},this.setSession=async function(l){if(r=l,r!==null){if(v=e.getRenderTarget(),r.addEventListener(`select`,A),r.addEventListener(`selectstart`,A),r.addEventListener(`selectend`,A),r.addEventListener(`squeeze`,A),r.addEventListener(`squeezestart`,A),r.addEventListener(`squeezeend`,A),r.addEventListener(`end`,j),r.addEventListener(`inputsourceschange`,M),_.xrCompatible!==!0&&await t.makeXRCompatible(),C=e.getPixelRatio(),e.getSize(S),m&&`createProjectionLayer`in XRWebGLBinding.prototype){let n=null,a=null,o=null;_.depth&&(o=_.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,n=_.stencil?ya:va,a=_.stencil?fa:sa);let s={colorFormat:t.RGBA8,depthFormat:o,scaleFactor:i};u=this.getBinding(),d=u.createProjectionLayer(s),r.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),y=new Os(d.textureWidth,d.textureHeight,{format:_a,type:na,depthTexture:new au(d.textureWidth,d.textureHeight,a,void 0,void 0,void 0,void 0,void 0,void 0,n),stencilBuffer:_.stencil,colorSpace:e.outputColorSpace,samples:_.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}else{let n={antialias:_.antialias,alpha:!0,depth:_.depth,stencil:_.stencil,framebufferScaleFactor:i};f=new XRWebGLLayer(r,t,n),r.updateRenderState({baseLayer:f}),e.setPixelRatio(1),e.setSize(f.framebufferWidth,f.framebufferHeight,!1),y=new Os(f.framebufferWidth,f.framebufferHeight,{format:_a,type:na,colorSpace:e.outputColorSpace,stencilBuffer:_.stencil,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(s),c=null,a=await r.requestReferenceSpace(o),R.setContext(r),R.start(),n.isPresenting=!0,n.dispatchEvent({type:`sessionstart`})}},this.getEnvironmentBlendMode=function(){if(r!==null)return r.environmentBlendMode},this.getDepthTexture=function(){return h.getDepthTexture()};function M(e){for(let t=0;t<e.removed.length;t++){let n=e.removed[t],r=x.indexOf(n);r>=0&&(x[r]=null,b[r].disconnect(n))}for(let t=0;t<e.added.length;t++){let n=e.added[t],r=x.indexOf(n);if(r===-1){for(let e=0;e<b.length;e++)if(e>=x.length){x.push(n),r=e;break}else if(x[e]===null){x[e]=n,r=e;break}if(r===-1)break}let i=b[r];i&&i.connect(n)}}let N=new J,P=new J;function F(e,t,n){N.setFromMatrixPosition(t.matrixWorld),P.setFromMatrixPosition(n.matrixWorld);let r=N.distanceTo(P),i=t.projectionMatrix.elements,a=n.projectionMatrix.elements,o=i[14]/(i[10]-1),s=i[14]/(i[10]+1),c=(i[9]+1)/i[5],l=(i[9]-1)/i[5],u=(i[8]-1)/i[0],d=(a[8]+1)/a[0],f=o*u,p=o*d,m=r/(-u+d),h=m*-u;if(t.matrixWorld.decompose(e.position,e.quaternion,e.scale),e.translateX(h),e.translateZ(m),e.matrixWorld.compose(e.position,e.quaternion,e.scale),e.matrixWorldInverse.copy(e.matrixWorld).invert(),i[10]===-1)e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse);else{let t=o+m,n=s+m,i=f-h,a=p+(r-h),u=c*s/n*t,d=l*s/n*t;e.projectionMatrix.makePerspective(i,a,u,d,t,n),e.projectionMatrixInverse.copy(e.projectionMatrix).invert()}}function I(e,t){t===null?e.matrixWorld.copy(e.matrix):e.matrixWorld.multiplyMatrices(t.matrixWorld,e.matrix),e.matrixWorldInverse.copy(e.matrixWorld).invert()}this.updateCamera=function(e){if(r===null)return;let t=e.near,n=e.far;h.texture!==null&&(h.depthNear>0&&(t=h.depthNear),h.depthFar>0&&(n=h.depthFar)),D.near=T.near=w.near=t,D.far=T.far=w.far=n,(O!==D.near||k!==D.far)&&(r.updateRenderState({depthNear:D.near,depthFar:D.far}),O=D.near,k=D.far),D.layers.mask=e.layers.mask|6,w.layers.mask=D.layers.mask&-5,T.layers.mask=D.layers.mask&-3;let i=e.parent,a=D.cameras;I(D,i);for(let e=0;e<a.length;e++)I(a[e],i);a.length===2?F(D,w,T):D.projectionMatrix.copy(w.projectionMatrix),ee(e,D,i)};function ee(e,t,n){n===null?e.matrix.copy(t.matrixWorld):(e.matrix.copy(n.matrixWorld),e.matrix.invert(),e.matrix.multiply(t.matrixWorld)),e.matrix.decompose(e.position,e.quaternion,e.scale),e.updateMatrixWorld(!0),e.projectionMatrix.copy(t.projectionMatrix),e.projectionMatrixInverse.copy(t.projectionMatrixInverse),e.isPerspectiveCamera&&(e.fov=Ro*2*Math.atan(1/e.projectionMatrix.elements[5]),e.zoom=1)}this.getCamera=function(){return D},this.getFoveation=function(){if(!(d===null&&f===null))return s},this.setFoveation=function(e){s=e,d!==null&&(d.fixedFoveation=e),f!==null&&f.fixedFoveation!==void 0&&(f.fixedFoveation=e)},this.hasDepthSensing=function(){return h.texture!==null},this.getDepthSensingMesh=function(){return h.getMesh(D)},this.getCameraTexture=function(e){return g[e]};let L=null;function te(t,i){if(l=i.getViewerPose(c||a),p=i,l!==null){let t=l.views;f!==null&&(e.setRenderTargetFramebuffer(y,f.framebuffer),e.setRenderTarget(y));let i=!1;t.length!==D.cameras.length&&(D.cameras.length=0,i=!0);for(let n=0;n<t.length;n++){let r=t[n],a=null;if(f!==null)a=f.getViewport(r);else{let t=u.getViewSubImage(d,r);a=t.viewport,n===0&&(e.setRenderTargetTextures(y,t.colorTexture,t.depthStencilTexture),e.setRenderTarget(y))}let o=E[n];o===void 0&&(o=new Qu,o.layers.enable(n),o.viewport=new Es,E[n]=o),o.matrix.fromArray(r.transform.matrix),o.matrix.decompose(o.position,o.quaternion,o.scale),o.projectionMatrix.fromArray(r.projectionMatrix),o.projectionMatrixInverse.copy(o.projectionMatrix).invert(),o.viewport.set(a.x,a.y,a.width,a.height),n===0&&(D.matrix.copy(o.matrix),D.matrix.decompose(D.position,D.quaternion,D.scale)),i===!0&&D.cameras.push(o)}let a=r.enabledFeatures;if(a&&a.includes(`depth-sensing`)&&r.depthUsage==`gpu-optimized`&&m){u=n.getBinding();let e=u.getDepthInformation(t[0]);e&&e.isValid&&e.texture&&h.init(e,r.renderState)}if(a&&a.includes(`camera-access`)&&m){e.state.unbindTexture(),u=n.getBinding();for(let e=0;e<t.length;e++){let n=t[e].camera;if(n){let e=g[n];e||(e=new su,g[n]=e);let t=u.getCameraImage(n);e.sourceTexture=t}}}}for(let e=0;e<b.length;e++){let t=x[e],n=b[e];t!==null&&n!==void 0&&n.update(t,i,c||a)}L&&L(t,i),i.detectedPlanes&&n.dispatchEvent({type:`planesdetected`,data:i}),p=null}let R=new kd;R.setAnimationLoop(te),this.setAnimationLoop=function(e){L=e},this.dispose=function(){}}},zm=new js,Bm=new Y;Bm.set(-1,0,0,0,1,0,0,0,1);function Vm(e,t){function n(e,t){e.matrixAutoUpdate===!0&&e.updateMatrix(),t.value.copy(e.matrix)}function r(t,n){n.color.getRGB(t.fogColor.value,mu(e)),n.isFog?(t.fogNear.value=n.near,t.fogFar.value=n.far):n.isFogExp2&&(t.fogDensity.value=n.density)}function i(e,t,n,r,i){t.isNodeMaterial?t.uniformsNeedUpdate=!1:t.isMeshBasicMaterial?a(e,t):t.isMeshLambertMaterial?(a(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshToonMaterial?(a(e,t),d(e,t)):t.isMeshPhongMaterial?(a(e,t),u(e,t),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)):t.isMeshStandardMaterial?(a(e,t),f(e,t),t.isMeshPhysicalMaterial&&p(e,t,i)):t.isMeshMatcapMaterial?(a(e,t),m(e,t)):t.isMeshDepthMaterial?a(e,t):t.isMeshDistanceMaterial?(a(e,t),h(e,t)):t.isMeshNormalMaterial?a(e,t):t.isLineBasicMaterial?(o(e,t),t.isLineDashedMaterial&&s(e,t)):t.isPointsMaterial?c(e,t,n,r):t.isSpriteMaterial?l(e,t):t.isShadowMaterial?(e.color.value.copy(t.color),e.opacity.value=t.opacity):t.isShaderMaterial&&(t.uniformsNeedUpdate=!1)}function a(e,r){e.opacity.value=r.opacity,r.color&&e.diffuse.value.copy(r.color),r.emissive&&e.emissive.value.copy(r.emissive).multiplyScalar(r.emissiveIntensity),r.map&&(e.map.value=r.map,n(r.map,e.mapTransform)),r.alphaMap&&(e.alphaMap.value=r.alphaMap,n(r.alphaMap,e.alphaMapTransform)),r.bumpMap&&(e.bumpMap.value=r.bumpMap,n(r.bumpMap,e.bumpMapTransform),e.bumpScale.value=r.bumpScale,r.side===1&&(e.bumpScale.value*=-1)),r.normalMap&&(e.normalMap.value=r.normalMap,n(r.normalMap,e.normalMapTransform),e.normalScale.value.copy(r.normalScale),r.side===1&&e.normalScale.value.negate()),r.displacementMap&&(e.displacementMap.value=r.displacementMap,n(r.displacementMap,e.displacementMapTransform),e.displacementScale.value=r.displacementScale,e.displacementBias.value=r.displacementBias),r.emissiveMap&&(e.emissiveMap.value=r.emissiveMap,n(r.emissiveMap,e.emissiveMapTransform)),r.specularMap&&(e.specularMap.value=r.specularMap,n(r.specularMap,e.specularMapTransform)),r.alphaTest>0&&(e.alphaTest.value=r.alphaTest);let i=t.get(r),a=i.envMap,o=i.envMapRotation;a&&(e.envMap.value=a,e.envMapRotation.value.setFromMatrix4(zm.makeRotationFromEuler(o)).transpose(),a.isCubeTexture&&a.isRenderTargetTexture===!1&&e.envMapRotation.value.premultiply(Bm),e.reflectivity.value=r.reflectivity,e.ior.value=r.ior,e.refractionRatio.value=r.refractionRatio),r.lightMap&&(e.lightMap.value=r.lightMap,e.lightMapIntensity.value=r.lightMapIntensity,n(r.lightMap,e.lightMapTransform)),r.aoMap&&(e.aoMap.value=r.aoMap,e.aoMapIntensity.value=r.aoMapIntensity,n(r.aoMap,e.aoMapTransform))}function o(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform))}function s(e,t){e.dashSize.value=t.dashSize,e.totalSize.value=t.dashSize+t.gapSize,e.scale.value=t.scale}function c(e,t,r,i){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.size.value=t.size*r,e.scale.value=i*.5,t.map&&(e.map.value=t.map,n(t.map,e.uvTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function l(e,t){e.diffuse.value.copy(t.color),e.opacity.value=t.opacity,e.rotation.value=t.rotation,t.map&&(e.map.value=t.map,n(t.map,e.mapTransform)),t.alphaMap&&(e.alphaMap.value=t.alphaMap,n(t.alphaMap,e.alphaMapTransform)),t.alphaTest>0&&(e.alphaTest.value=t.alphaTest)}function u(e,t){e.specular.value.copy(t.specular),e.shininess.value=Math.max(t.shininess,1e-4)}function d(e,t){t.gradientMap&&(e.gradientMap.value=t.gradientMap)}function f(e,t){e.metalness.value=t.metalness,t.metalnessMap&&(e.metalnessMap.value=t.metalnessMap,n(t.metalnessMap,e.metalnessMapTransform)),e.roughness.value=t.roughness,t.roughnessMap&&(e.roughnessMap.value=t.roughnessMap,n(t.roughnessMap,e.roughnessMapTransform)),t.envMap&&(e.envMapIntensity.value=t.envMapIntensity)}function p(e,t,r){e.ior.value=t.ior,t.sheen>0&&(e.sheenColor.value.copy(t.sheenColor).multiplyScalar(t.sheen),e.sheenRoughness.value=t.sheenRoughness,t.sheenColorMap&&(e.sheenColorMap.value=t.sheenColorMap,n(t.sheenColorMap,e.sheenColorMapTransform)),t.sheenRoughnessMap&&(e.sheenRoughnessMap.value=t.sheenRoughnessMap,n(t.sheenRoughnessMap,e.sheenRoughnessMapTransform))),t.clearcoat>0&&(e.clearcoat.value=t.clearcoat,e.clearcoatRoughness.value=t.clearcoatRoughness,t.clearcoatMap&&(e.clearcoatMap.value=t.clearcoatMap,n(t.clearcoatMap,e.clearcoatMapTransform)),t.clearcoatRoughnessMap&&(e.clearcoatRoughnessMap.value=t.clearcoatRoughnessMap,n(t.clearcoatRoughnessMap,e.clearcoatRoughnessMapTransform)),t.clearcoatNormalMap&&(e.clearcoatNormalMap.value=t.clearcoatNormalMap,n(t.clearcoatNormalMap,e.clearcoatNormalMapTransform),e.clearcoatNormalScale.value.copy(t.clearcoatNormalScale),t.side===1&&e.clearcoatNormalScale.value.negate())),t.dispersion>0&&(e.dispersion.value=t.dispersion),t.iridescence>0&&(e.iridescence.value=t.iridescence,e.iridescenceIOR.value=t.iridescenceIOR,e.iridescenceThicknessMinimum.value=t.iridescenceThicknessRange[0],e.iridescenceThicknessMaximum.value=t.iridescenceThicknessRange[1],t.iridescenceMap&&(e.iridescenceMap.value=t.iridescenceMap,n(t.iridescenceMap,e.iridescenceMapTransform)),t.iridescenceThicknessMap&&(e.iridescenceThicknessMap.value=t.iridescenceThicknessMap,n(t.iridescenceThicknessMap,e.iridescenceThicknessMapTransform))),t.transmission>0&&(e.transmission.value=t.transmission,e.transmissionSamplerMap.value=r.texture,e.transmissionSamplerSize.value.set(r.width,r.height),t.transmissionMap&&(e.transmissionMap.value=t.transmissionMap,n(t.transmissionMap,e.transmissionMapTransform)),e.thickness.value=t.thickness,t.thicknessMap&&(e.thicknessMap.value=t.thicknessMap,n(t.thicknessMap,e.thicknessMapTransform)),e.attenuationDistance.value=t.attenuationDistance,e.attenuationColor.value.copy(t.attenuationColor)),t.anisotropy>0&&(e.anisotropyVector.value.set(t.anisotropy*Math.cos(t.anisotropyRotation),t.anisotropy*Math.sin(t.anisotropyRotation)),t.anisotropyMap&&(e.anisotropyMap.value=t.anisotropyMap,n(t.anisotropyMap,e.anisotropyMapTransform))),e.specularIntensity.value=t.specularIntensity,e.specularColor.value.copy(t.specularColor),t.specularColorMap&&(e.specularColorMap.value=t.specularColorMap,n(t.specularColorMap,e.specularColorMapTransform)),t.specularIntensityMap&&(e.specularIntensityMap.value=t.specularIntensityMap,n(t.specularIntensityMap,e.specularIntensityMapTransform))}function m(e,t){t.matcap&&(e.matcap.value=t.matcap)}function h(e,n){let r=t.get(n).light;e.referencePosition.value.setFromMatrixPosition(r.matrixWorld),e.nearDistance.value=r.shadow.camera.near,e.farDistance.value=r.shadow.camera.far}return{refreshFogUniforms:r,refreshMaterialUniforms:i}}function Hm(e,t,n,r){let i={},a={},o=[],s=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function c(e,t){let n=t.program;r.uniformBlockBinding(e,n)}function l(e,n){let o=i[e.id];o===void 0&&(m(e),o=u(e),i[e.id]=o,e.addEventListener(`dispose`,g));let s=n.program;r.updateUBOMapping(e,s);let c=t.render.frame;a[e.id]!==c&&(f(e),a[e.id]=c)}function u(t){let n=d();t.__bindingPointIndex=n;let r=e.createBuffer(),i=t.__size,a=t.usage;return e.bindBuffer(e.UNIFORM_BUFFER,r),e.bufferData(e.UNIFORM_BUFFER,i,a),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,n,r),r}function d(){for(let e=0;e<s;e++)if(o.indexOf(e)===-1)return o.push(e),e;return K(`WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached.`),0}function f(t){let n=i[t.id],r=t.uniforms,a=t.__cache;e.bindBuffer(e.UNIFORM_BUFFER,n);for(let t=0,n=r.length;t<n;t++){let n=Array.isArray(r[t])?r[t]:[r[t]];for(let r=0,i=n.length;r<i;r++){let i=n[r];if(p(i,t,r,a)===!0){let t=i.__offset,n=Array.isArray(i.value)?i.value:[i.value],r=0;for(let a=0;a<n.length;a++){let o=n[a],s=h(o);typeof o==`number`||typeof o==`boolean`?(i.__data[0]=o,e.bufferSubData(e.UNIFORM_BUFFER,t+r,i.__data)):o.isMatrix3?(i.__data[0]=o.elements[0],i.__data[1]=o.elements[1],i.__data[2]=o.elements[2],i.__data[3]=0,i.__data[4]=o.elements[3],i.__data[5]=o.elements[4],i.__data[6]=o.elements[5],i.__data[7]=0,i.__data[8]=o.elements[6],i.__data[9]=o.elements[7],i.__data[10]=o.elements[8],i.__data[11]=0):ArrayBuffer.isView(o)?i.__data.set(new o.constructor(o.buffer,o.byteOffset,i.__data.length)):(o.toArray(i.__data,r),r+=s.storage/Float32Array.BYTES_PER_ELEMENT)}e.bufferSubData(e.UNIFORM_BUFFER,t,i.__data)}}}e.bindBuffer(e.UNIFORM_BUFFER,null)}function p(e,t,n,r){let i=e.value,a=t+`_`+n;if(r[a]===void 0)return typeof i==`number`||typeof i==`boolean`?r[a]=i:ArrayBuffer.isView(i)?r[a]=i.slice():r[a]=i.clone(),!0;{let e=r[a];if(typeof i==`number`||typeof i==`boolean`){if(e!==i)return r[a]=i,!0}else if(ArrayBuffer.isView(i))return!0;else if(e.equals(i)===!1)return e.copy(i),!0}return!1}function m(e){let t=e.uniforms,n=0;for(let e=0,r=t.length;e<r;e++){let r=Array.isArray(t[e])?t[e]:[t[e]];for(let e=0,t=r.length;e<t;e++){let t=r[e],i=Array.isArray(t.value)?t.value:[t.value];for(let e=0,r=i.length;e<r;e++){let r=i[e],a=h(r),o=n%16,s=o%a.boundary,c=o+s;n+=s,c!==0&&16-c<a.storage&&(n+=16-c),t.__data=new Float32Array(a.storage/Float32Array.BYTES_PER_ELEMENT),t.__offset=n,n+=a.storage}}}let r=n%16;return r>0&&(n+=16-r),e.__size=n,e.__cache={},this}function h(e){let t={boundary:0,storage:0};return typeof e==`number`||typeof e==`boolean`?(t.boundary=4,t.storage=4):e.isVector2?(t.boundary=8,t.storage=8):e.isVector3||e.isColor?(t.boundary=16,t.storage=12):e.isVector4?(t.boundary=16,t.storage=16):e.isMatrix3?(t.boundary=48,t.storage=48):e.isMatrix4?(t.boundary=64,t.storage=64):e.isTexture?G(`WebGLRenderer: Texture samplers can not be part of an uniforms group.`):ArrayBuffer.isView(e)?(t.boundary=16,t.storage=e.byteLength):G(`WebGLRenderer: Unsupported uniform value type.`,e),t}function g(t){let n=t.target;n.removeEventListener(`dispose`,g);let r=o.indexOf(n.__bindingPointIndex);o.splice(r,1),e.deleteBuffer(i[n.id]),delete i[n.id],delete a[n.id]}function _(){for(let t in i)e.deleteBuffer(i[t]);o=[],i={},a={}}return{bind:c,update:l,dispose:_}}var Um=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]),Wm=null;function Gm(){return Wm===null&&(Wm=new Nl(Um,16,16,Sa,la),Wm.name=`DFG_LUT`,Wm.minFilter=$i,Wm.magFilter=$i,Wm.wrapS=Ji,Wm.wrapT=Ji,Wm.generateMipmaps=!1,Wm.needsUpdate=!0),Wm}var Km=class{constructor(e={}){let{canvas:t=Eo(),context:n=null,depth:r=!0,stencil:i=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:s=!0,preserveDrawingBuffer:c=!1,powerPreference:l=`default`,failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:f=na}=e;this.isWebGLRenderer=!0;let p;if(n!==null){if(typeof WebGLRenderingContext<`u`&&n instanceof WebGLRenderingContext)throw Error(`THREE.WebGLRenderer: WebGL 1 is not supported since r163.`);p=n.getContextAttributes().alpha}else p=a;let m=f,h=new Set([wa,Ca,xa]),g=new Set([na,sa,aa,fa,ua,da]),_=new Uint32Array(4),v=new Int32Array(4),y=new J,b=null,x=null,S=[],C=[],w=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=0,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let T=this,E=!1,D=null;this._outputColorSpace=go;let O=0,k=0,A=null,j=-1,M=null,N=new Es,P=new Es,F=null,I=new X(0),ee=0,L=t.width,te=t.height,R=1,ne=null,re=null,ie=new Es(0,0,L,te),ae=new Es(0,0,L,te),oe=!1,se=new Xl,ce=!1,le=!1,ue=new js,de=new J,fe=new Es,pe={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},me=!1;function he(){return A===null?R:1}let z=n;function ge(e,n){return t.getContext(e,n)}try{let e={alpha:!0,depth:r,stencil:i,antialias:o,premultipliedAlpha:s,preserveDrawingBuffer:c,powerPreference:l,failIfMajorPerformanceCaveat:u};if(`setAttribute`in t&&t.setAttribute(`data-engine`,`three.js r184`),t.addEventListener(`webglcontextlost`,ze,!1),t.addEventListener(`webglcontextrestored`,Be,!1),t.addEventListener(`webglcontextcreationerror`,Ve,!1),z===null){let t=`webgl2`;if(z=ge(t,e),z===null)throw ge(t)?Error(`Error creating WebGL context with your selected attributes.`):Error(`Error creating WebGL context.`)}}catch(e){throw K(`WebGLRenderer: `+e.message),e}let _e,ve,B,ye,V,H,be,xe,Se,Ce,we,Te,Ee,De,Oe,ke,Ae,je,Me,Ne,Pe,Fe,Ie;function Le(){_e=new uf(z),_e.init(),Pe=new Pm(z,_e),ve=new zd(z,_e,e,Pe),B=new Mm(z,_e),ve.reversedDepthBuffer&&d&&B.buffers.depth.setReversed(!0),ye=new pf(z),V=new fm,H=new Nm(z,_e,B,V,ve,Pe,ye),be=new lf(T),xe=new Ad(z),Fe=new Ld(z,xe),Se=new df(z,xe,ye,Fe),Ce=new hf(z,Se,xe,Fe,ye),je=new mf(z,ve,H),Oe=new Bd(V),we=new dm(T,be,_e,ve,Fe,Oe),Te=new Vm(T,V),Ee=new gm,De=new Cm(_e),Ae=new Id(T,be,B,Ce,p,s),ke=new jm(T,Ce,ve),Ie=new Hm(z,ye,ve,B),Me=new Rd(z,_e,ye),Ne=new ff(z,_e,ye),ye.programs=we.programs,T.capabilities=ve,T.extensions=_e,T.properties=V,T.renderLists=Ee,T.shadowMap=ke,T.state=B,T.info=ye}Le(),m!==1009&&(w=new _f(m,t.width,t.height,r,i));let Re=new Rm(T,z);this.xr=Re,this.getContext=function(){return z},this.getContextAttributes=function(){return z.getContextAttributes()},this.forceContextLoss=function(){let e=_e.get(`WEBGL_lose_context`);e&&e.loseContext()},this.forceContextRestore=function(){let e=_e.get(`WEBGL_lose_context`);e&&e.restoreContext()},this.getPixelRatio=function(){return R},this.setPixelRatio=function(e){e!==void 0&&(R=e,this.setSize(L,te,!1))},this.getSize=function(e){return e.set(L,te)},this.setSize=function(e,n,r=!0){if(Re.isPresenting){G(`WebGLRenderer: Can't change size while VR device is presenting.`);return}L=e,te=n,t.width=Math.floor(e*R),t.height=Math.floor(n*R),r===!0&&(t.style.width=e+`px`,t.style.height=n+`px`),w!==null&&w.setSize(t.width,t.height),this.setViewport(0,0,e,n)},this.getDrawingBufferSize=function(e){return e.set(L*R,te*R).floor()},this.setDrawingBufferSize=function(e,n,r){L=e,te=n,R=r,t.width=Math.floor(e*r),t.height=Math.floor(n*r),this.setViewport(0,0,e,n)},this.setEffects=function(e){if(m===1009){K(`THREE.WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.`);return}if(e){for(let t=0;t<e.length;t++)if(e[t].isOutputPass===!0){G(`THREE.WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.`);break}}w.setEffects(e||[])},this.getCurrentViewport=function(e){return e.copy(N)},this.getViewport=function(e){return e.copy(ie)},this.setViewport=function(e,t,n,r){e.isVector4?ie.set(e.x,e.y,e.z,e.w):ie.set(e,t,n,r),B.viewport(N.copy(ie).multiplyScalar(R).round())},this.getScissor=function(e){return e.copy(ae)},this.setScissor=function(e,t,n,r){e.isVector4?ae.set(e.x,e.y,e.z,e.w):ae.set(e,t,n,r),B.scissor(P.copy(ae).multiplyScalar(R).round())},this.getScissorTest=function(){return oe},this.setScissorTest=function(e){B.setScissorTest(oe=e)},this.setOpaqueSort=function(e){ne=e},this.setTransparentSort=function(e){re=e},this.getClearColor=function(e){return e.copy(Ae.getClearColor())},this.setClearColor=function(){Ae.setClearColor(...arguments)},this.getClearAlpha=function(){return Ae.getClearAlpha()},this.setClearAlpha=function(){Ae.setClearAlpha(...arguments)},this.clear=function(e=!0,t=!0,n=!0){let r=0;if(e){let e=!1;if(A!==null){let t=A.texture.format;e=h.has(t)}if(e){let e=A.texture.type,t=g.has(e),n=Ae.getClearColor(),r=Ae.getClearAlpha(),i=n.r,a=n.g,o=n.b;t?(_[0]=i,_[1]=a,_[2]=o,_[3]=r,z.clearBufferuiv(z.COLOR,0,_)):(v[0]=i,v[1]=a,v[2]=o,v[3]=r,z.clearBufferiv(z.COLOR,0,v))}else r|=z.COLOR_BUFFER_BIT}t&&(r|=z.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),n&&(r|=z.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),r!==0&&z.clear(r)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(e){e.setRenderer(this),D=e},this.dispose=function(){t.removeEventListener(`webglcontextlost`,ze,!1),t.removeEventListener(`webglcontextrestored`,Be,!1),t.removeEventListener(`webglcontextcreationerror`,Ve,!1),Ae.dispose(),Ee.dispose(),De.dispose(),V.dispose(),be.dispose(),Ce.dispose(),Fe.dispose(),Ie.dispose(),we.dispose(),Re.dispose(),Re.removeEventListener(`sessionstart`,Je),Re.removeEventListener(`sessionend`,Ye),Xe.stop()};function ze(e){e.preventDefault(),ko(`WebGLRenderer: Context Lost.`),E=!0}function Be(){ko(`WebGLRenderer: Context Restored.`),E=!1;let e=ye.autoReset,t=ke.enabled,n=ke.autoUpdate,r=ke.needsUpdate,i=ke.type;Le(),ye.autoReset=e,ke.enabled=t,ke.autoUpdate=n,ke.needsUpdate=r,ke.type=i}function Ve(e){K(`WebGLRenderer: A WebGL context could not be created. Reason: `,e.statusMessage)}function He(e){let t=e.target;t.removeEventListener(`dispose`,He),Ue(t)}function Ue(e){We(e),V.remove(e)}function We(e){let t=V.get(e).programs;t!==void 0&&(t.forEach(function(e){we.releaseProgram(e)}),e.isShaderMaterial&&we.releaseShaderCache(e))}this.renderBufferDirect=function(e,t,n,r,i,a){t===null&&(t=pe);let o=i.isMesh&&i.matrixWorld.determinant()<0,s=ot(e,t,n,r,i);B.setMaterial(r,o);let c=n.index,l=1;if(r.wireframe===!0){if(c=Se.getWireframeAttribute(n),c===void 0)return;l=2}let u=n.drawRange,d=n.attributes.position,f=u.start*l,p=(u.start+u.count)*l;a!==null&&(f=Math.max(f,a.start*l),p=Math.min(p,(a.start+a.count)*l)),c===null?d!=null&&(f=Math.max(f,0),p=Math.min(p,d.count)):(f=Math.max(f,0),p=Math.min(p,c.count));let m=p-f;if(m<0||m===1/0)return;Fe.setup(i,r,s,n,c);let h,g=Me;if(c!==null&&(h=xe.get(c),g=Ne,g.setIndex(h)),i.isMesh)r.wireframe===!0?(B.setLineWidth(r.wireframeLinewidth*he()),g.setMode(z.LINES)):g.setMode(z.TRIANGLES);else if(i.isLine){let e=r.linewidth;e===void 0&&(e=1),B.setLineWidth(e*he()),i.isLineSegments?g.setMode(z.LINES):i.isLineLoop?g.setMode(z.LINE_LOOP):g.setMode(z.LINE_STRIP)}else i.isPoints?g.setMode(z.POINTS):i.isSprite&&g.setMode(z.TRIANGLES);if(i.isBatchedMesh)if(_e.get(`WEBGL_multi_draw`))g.renderMultiDraw(i._multiDrawStarts,i._multiDrawCounts,i._multiDrawCount);else{let e=i._multiDrawStarts,t=i._multiDrawCounts,n=i._multiDrawCount,a=c?xe.get(c).bytesPerElement:1,o=V.get(r).currentProgram.getUniforms();for(let r=0;r<n;r++)o.setValue(z,`_gl_DrawID`,r),g.render(e[r]/a,t[r])}else if(i.isInstancedMesh)g.renderInstances(f,m,i.count);else if(n.isInstancedBufferGeometry){let e=n._maxInstanceCount===void 0?1/0:n._maxInstanceCount,t=Math.min(n.instanceCount,e);g.renderInstances(f,m,t)}else g.render(f,m)};function Ge(e,t,n){e.transparent===!0&&e.side===2&&e.forceSinglePass===!1?(e.side=1,e.needsUpdate=!0,nt(e,t,n),e.side=0,e.needsUpdate=!0,nt(e,t,n),e.side=2):nt(e,t,n)}this.compile=function(e,t,n=null){n===null&&(n=e),x=De.get(n),x.init(t),C.push(x),n.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(x.pushLight(e),e.castShadow&&x.pushShadow(e))}),e!==n&&e.traverseVisible(function(e){e.isLight&&e.layers.test(t.layers)&&(x.pushLight(e),e.castShadow&&x.pushShadow(e))}),x.setupLights();let r=new Set;return e.traverse(function(e){if(!(e.isMesh||e.isPoints||e.isLine||e.isSprite))return;let t=e.material;if(t)if(Array.isArray(t))for(let i=0;i<t.length;i++){let a=t[i];Ge(a,n,e),r.add(a)}else Ge(t,n,e),r.add(t)}),x=C.pop(),r},this.compileAsync=function(e,t,n=null){let r=this.compile(e,t,n);return new Promise(t=>{function n(){if(r.forEach(function(e){V.get(e).currentProgram.isReady()&&r.delete(e)}),r.size===0){t(e);return}setTimeout(n,10)}_e.get(`KHR_parallel_shader_compile`)===null?setTimeout(n,10):n()})};let Ke=null;function qe(e){Ke&&Ke(e)}function Je(){Xe.stop()}function Ye(){Xe.start()}let Xe=new kd;Xe.setAnimationLoop(qe),typeof self<`u`&&Xe.setContext(self),this.setAnimationLoop=function(e){Ke=e,Re.setAnimationLoop(e),e===null?Xe.stop():Xe.start()},Re.addEventListener(`sessionstart`,Je),Re.addEventListener(`sessionend`,Ye),this.render=function(e,t){if(t!==void 0&&t.isCamera!==!0){K(`WebGLRenderer.render: camera is not an instance of THREE.Camera.`);return}if(E===!0)return;D!==null&&D.renderStart(e,t);let n=Re.enabled===!0&&Re.isPresenting===!0,r=w!==null&&(A===null||n)&&w.begin(T,A);if(e.matrixWorldAutoUpdate===!0&&e.updateMatrixWorld(),t.parent===null&&t.matrixWorldAutoUpdate===!0&&t.updateMatrixWorld(),Re.enabled===!0&&Re.isPresenting===!0&&(w===null||w.isCompositing()===!1)&&(Re.cameraAutoUpdate===!0&&Re.updateCamera(t),t=Re.getCamera()),e.isScene===!0&&e.onBeforeRender(T,e,t,A),x=De.get(e,C.length),x.init(t),x.state.textureUnits=H.getTextureUnits(),C.push(x),ue.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),se.setFromProjectionMatrix(ue,So,t.reversedDepth),le=this.localClippingEnabled,ce=Oe.init(this.clippingPlanes,le),b=Ee.get(e,S.length),b.init(),S.push(b),Re.enabled===!0&&Re.isPresenting===!0){let e=T.xr.getDepthSensingMesh();e!==null&&Ze(e,t,-1/0,T.sortObjects)}Ze(e,t,0,T.sortObjects),b.finish(),T.sortObjects===!0&&b.sort(ne,re),me=Re.enabled===!1||Re.isPresenting===!1||Re.hasDepthSensing()===!1,me&&Ae.addToRenderList(b,e),this.info.render.frame++,ce===!0&&Oe.beginShadows();let i=x.state.shadowsArray;if(ke.render(i,e,t),ce===!0&&Oe.endShadows(),this.info.autoReset===!0&&this.info.reset(),(r&&w.hasRenderPass())===!1){let n=b.opaque,r=b.transmissive;if(x.setupLights(),t.isArrayCamera){let i=t.cameras;if(r.length>0)for(let t=0,a=i.length;t<a;t++){let a=i[t];$e(n,r,e,a)}me&&Ae.render(e);for(let t=0,n=i.length;t<n;t++){let n=i[t];Qe(b,e,n,n.viewport)}}else r.length>0&&$e(n,r,e,t),me&&Ae.render(e),Qe(b,e,t)}A!==null&&k===0&&(H.updateMultisampleRenderTarget(A),H.updateRenderTargetMipmap(A)),r&&w.end(T),e.isScene===!0&&e.onAfterRender(T,e,t),Fe.resetDefaultState(),j=-1,M=null,C.pop(),C.length>0?(x=C[C.length-1],H.setTextureUnits(x.state.textureUnits),ce===!0&&Oe.setGlobalState(T.clippingPlanes,x.state.camera)):x=null,S.pop(),b=S.length>0?S[S.length-1]:null,D!==null&&D.renderEnd()};function Ze(e,t,n,r){if(e.visible===!1)return;if(e.layers.test(t.layers)){if(e.isGroup)n=e.renderOrder;else if(e.isLOD)e.autoUpdate===!0&&e.update(t);else if(e.isLightProbeGrid)x.pushLightProbeGrid(e);else if(e.isLight)x.pushLight(e),e.castShadow&&x.pushShadow(e);else if(e.isSprite){if(!e.frustumCulled||se.intersectsSprite(e)){r&&fe.setFromMatrixPosition(e.matrixWorld).applyMatrix4(ue);let t=Ce.update(e),i=e.material;i.visible&&b.push(e,t,i,n,fe.z,null)}}else if((e.isMesh||e.isLine||e.isPoints)&&(!e.frustumCulled||se.intersectsObject(e))){let t=Ce.update(e),i=e.material;if(r&&(e.boundingSphere===void 0?(t.boundingSphere===null&&t.computeBoundingSphere(),fe.copy(t.boundingSphere.center)):(e.boundingSphere===null&&e.computeBoundingSphere(),fe.copy(e.boundingSphere.center)),fe.applyMatrix4(e.matrixWorld).applyMatrix4(ue)),Array.isArray(i)){let r=t.groups;for(let a=0,o=r.length;a<o;a++){let o=r[a],s=i[o.materialIndex];s&&s.visible&&b.push(e,t,s,n,fe.z,o)}}else i.visible&&b.push(e,t,i,n,fe.z,null)}}let i=e.children;for(let e=0,a=i.length;e<a;e++)Ze(i[e],t,n,r)}function Qe(e,t,n,r){let{opaque:i,transmissive:a,transparent:o}=e;x.setupLightsView(n),ce===!0&&Oe.setGlobalState(T.clippingPlanes,n),r&&B.viewport(N.copy(r)),i.length>0&&et(i,t,n),a.length>0&&et(a,t,n),o.length>0&&et(o,t,n),B.buffers.depth.setTest(!0),B.buffers.depth.setMask(!0),B.buffers.color.setMask(!0),B.setPolygonOffset(!1)}function $e(e,t,n,r){if((n.isScene===!0?n.overrideMaterial:null)!==null)return;if(x.state.transmissionRenderTarget[r.id]===void 0){let e=_e.has(`EXT_color_buffer_half_float`)||_e.has(`EXT_color_buffer_float`);x.state.transmissionRenderTarget[r.id]=new Os(1,1,{generateMipmaps:!0,type:e?la:na,minFilter:ta,samples:Math.max(4,ve.samples),stencilBuffer:i,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:hs.workingColorSpace})}let a=x.state.transmissionRenderTarget[r.id],o=r.viewport||N;a.setSize(o.z*T.transmissionResolutionScale,o.w*T.transmissionResolutionScale);let s=T.getRenderTarget(),c=T.getActiveCubeFace(),l=T.getActiveMipmapLevel();T.setRenderTarget(a),T.getClearColor(I),ee=T.getClearAlpha(),ee<1&&T.setClearColor(16777215,.5),T.clear(),me&&Ae.render(n);let u=T.toneMapping;T.toneMapping=0;let d=r.viewport;if(r.viewport!==void 0&&(r.viewport=void 0),x.setupLightsView(r),ce===!0&&Oe.setGlobalState(T.clippingPlanes,r),et(e,n,r),H.updateMultisampleRenderTarget(a),H.updateRenderTargetMipmap(a),_e.has(`WEBGL_multisampled_render_to_texture`)===!1){let e=!1;for(let i=0,a=t.length;i<a;i++){let{object:a,geometry:o,material:s,group:c}=t[i];if(s.side===2&&a.layers.test(r.layers)){let t=s.side;s.side=1,s.needsUpdate=!0,tt(a,n,r,o,s,c),s.side=t,s.needsUpdate=!0,e=!0}}e===!0&&(H.updateMultisampleRenderTarget(a),H.updateRenderTargetMipmap(a))}T.setRenderTarget(s,c,l),T.setClearColor(I,ee),d!==void 0&&(r.viewport=d),T.toneMapping=u}function et(e,t,n){let r=t.isScene===!0?t.overrideMaterial:null;for(let i=0,a=e.length;i<a;i++){let a=e[i],{object:o,geometry:s,group:c}=a,l=a.material;l.allowOverride===!0&&r!==null&&(l=r),o.layers.test(n.layers)&&tt(o,t,n,s,l,c)}}function tt(e,t,n,r,i,a){e.onBeforeRender(T,t,n,r,i,a),e.modelViewMatrix.multiplyMatrices(n.matrixWorldInverse,e.matrixWorld),e.normalMatrix.getNormalMatrix(e.modelViewMatrix),i.onBeforeRender(T,t,n,r,e,a),i.transparent===!0&&i.side===2&&i.forceSinglePass===!1?(i.side=1,i.needsUpdate=!0,T.renderBufferDirect(n,t,r,i,e,a),i.side=0,i.needsUpdate=!0,T.renderBufferDirect(n,t,r,i,e,a),i.side=2):T.renderBufferDirect(n,t,r,i,e,a),e.onAfterRender(T,t,n,r,i,a)}function nt(e,t,n){t.isScene!==!0&&(t=pe);let r=V.get(e),i=x.state.lights,a=x.state.shadowsArray,o=i.state.version,s=we.getParameters(e,i.state,a,t,n,x.state.lightProbeGridArray),c=we.getProgramCacheKey(s),l=r.programs;r.environment=e.isMeshStandardMaterial||e.isMeshLambertMaterial||e.isMeshPhongMaterial?t.environment:null,r.fog=t.fog;let u=e.isMeshStandardMaterial||e.isMeshLambertMaterial&&!e.envMap||e.isMeshPhongMaterial&&!e.envMap;r.envMap=be.get(e.envMap||r.environment,u),r.envMapRotation=r.environment!==null&&e.envMap===null?t.environmentRotation:e.envMapRotation,l===void 0&&(e.addEventListener(`dispose`,He),l=new Map,r.programs=l);let d=l.get(c);if(d!==void 0){if(r.currentProgram===d&&r.lightsStateVersion===o)return it(e,s),d}else s.uniforms=we.getUniforms(e),D!==null&&e.isNodeMaterial&&D.build(e,n,s),e.onBeforeCompile(s,T),d=we.acquireProgram(s,c),l.set(c,d),r.uniforms=s.uniforms;let f=r.uniforms;return(!e.isShaderMaterial&&!e.isRawShaderMaterial||e.clipping===!0)&&(f.clippingPlanes=Oe.uniform),it(e,s),r.needsLights=ct(e),r.lightsStateVersion=o,r.needsLights&&(f.ambientLightColor.value=i.state.ambient,f.lightProbe.value=i.state.probe,f.directionalLights.value=i.state.directional,f.directionalLightShadows.value=i.state.directionalShadow,f.spotLights.value=i.state.spot,f.spotLightShadows.value=i.state.spotShadow,f.rectAreaLights.value=i.state.rectArea,f.ltc_1.value=i.state.rectAreaLTC1,f.ltc_2.value=i.state.rectAreaLTC2,f.pointLights.value=i.state.point,f.pointLightShadows.value=i.state.pointShadow,f.hemisphereLights.value=i.state.hemi,f.directionalShadowMatrix.value=i.state.directionalShadowMatrix,f.spotLightMatrix.value=i.state.spotLightMatrix,f.spotLightMap.value=i.state.spotLightMap,f.pointShadowMatrix.value=i.state.pointShadowMatrix),r.lightProbeGrid=x.state.lightProbeGridArray.length>0,r.currentProgram=d,r.uniformsList=null,d}function rt(e){if(e.uniformsList===null){let t=e.currentProgram.getUniforms();e.uniformsList=wp.seqWithValue(t.seq,e.uniforms)}return e.uniformsList}function it(e,t){let n=V.get(e);n.outputColorSpace=t.outputColorSpace,n.batching=t.batching,n.batchingColor=t.batchingColor,n.instancing=t.instancing,n.instancingColor=t.instancingColor,n.instancingMorph=t.instancingMorph,n.skinning=t.skinning,n.morphTargets=t.morphTargets,n.morphNormals=t.morphNormals,n.morphColors=t.morphColors,n.morphTargetsCount=t.morphTargetsCount,n.numClippingPlanes=t.numClippingPlanes,n.numIntersection=t.numClipIntersection,n.vertexAlphas=t.vertexAlphas,n.vertexTangents=t.vertexTangents,n.toneMapping=t.toneMapping}function at(e,t){if(e.length===0)return null;if(e.length===1)return e[0].texture===null?null:e[0];y.setFromMatrixPosition(t.matrixWorld);for(let t=0,n=e.length;t<n;t++){let n=e[t];if(n.texture!==null&&n.boundingBox.containsPoint(y))return n}return null}function ot(e,t,n,r,i){t.isScene!==!0&&(t=pe),H.resetTextureUnits();let a=t.fog,o=r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial?t.environment:null,s=A===null?T.outputColorSpace:A.isXRRenderTarget===!0?A.texture.colorSpace:hs.workingColorSpace,c=r.isMeshStandardMaterial||r.isMeshLambertMaterial&&!r.envMap||r.isMeshPhongMaterial&&!r.envMap,l=be.get(r.envMap||o,c),u=r.vertexColors===!0&&!!n.attributes.color&&n.attributes.color.itemSize===4,d=!!n.attributes.tangent&&(!!r.normalMap||r.anisotropy>0),f=!!n.morphAttributes.position,p=!!n.morphAttributes.normal,m=!!n.morphAttributes.color,h=0;r.toneMapped&&(A===null||A.isXRRenderTarget===!0)&&(h=T.toneMapping);let g=n.morphAttributes.position||n.morphAttributes.normal||n.morphAttributes.color,_=g===void 0?0:g.length,v=V.get(r),y=x.state.lights;if(ce===!0&&(le===!0||e!==M)){let t=e===M&&r.id===j;Oe.setState(r,e,t)}let b=!1;r.version===v.__version?v.needsLights&&v.lightsStateVersion!==y.state.version?b=!0:v.outputColorSpace===s?i.isBatchedMesh&&v.batching===!1||!i.isBatchedMesh&&v.batching===!0||i.isBatchedMesh&&v.batchingColor===!0&&i.colorTexture===null||i.isBatchedMesh&&v.batchingColor===!1&&i.colorTexture!==null||i.isInstancedMesh&&v.instancing===!1||!i.isInstancedMesh&&v.instancing===!0||i.isSkinnedMesh&&v.skinning===!1||!i.isSkinnedMesh&&v.skinning===!0||i.isInstancedMesh&&v.instancingColor===!0&&i.instanceColor===null||i.isInstancedMesh&&v.instancingColor===!1&&i.instanceColor!==null||i.isInstancedMesh&&v.instancingMorph===!0&&i.morphTexture===null||i.isInstancedMesh&&v.instancingMorph===!1&&i.morphTexture!==null?b=!0:v.envMap===l?r.fog===!0&&v.fog!==a||v.numClippingPlanes!==void 0&&(v.numClippingPlanes!==Oe.numPlanes||v.numIntersection!==Oe.numIntersection)?b=!0:v.vertexAlphas===u&&v.vertexTangents===d&&v.morphTargets===f&&v.morphNormals===p&&v.morphColors===m&&v.toneMapping===h&&v.morphTargetsCount===_?!!v.lightProbeGrid!=x.state.lightProbeGridArray.length>0&&(b=!0):b=!0:b=!0:b=!0:(b=!0,v.__version=r.version);let S=v.currentProgram;b===!0&&(S=nt(r,t,i),D&&r.isNodeMaterial&&D.onUpdateProgram(r,S,v));let C=!1,w=!1,E=!1,O=S.getUniforms(),k=v.uniforms;if(B.useProgram(S.program)&&(C=!0,w=!0,E=!0),r.id!==j&&(j=r.id,w=!0),v.needsLights){let e=at(x.state.lightProbeGridArray,i);v.lightProbeGrid!==e&&(v.lightProbeGrid=e,w=!0)}if(C||M!==e){B.buffers.depth.getReversed()&&e.reversedDepth!==!0&&(e._reversedDepth=!0,e.updateProjectionMatrix()),O.setValue(z,`projectionMatrix`,e.projectionMatrix),O.setValue(z,`viewMatrix`,e.matrixWorldInverse);let t=O.map.cameraPosition;t!==void 0&&t.setValue(z,de.setFromMatrixPosition(e.matrixWorld)),ve.logarithmicDepthBuffer&&O.setValue(z,`logDepthBufFC`,2/(Math.log(e.far+1)/Math.LN2)),(r.isMeshPhongMaterial||r.isMeshToonMaterial||r.isMeshLambertMaterial||r.isMeshBasicMaterial||r.isMeshStandardMaterial||r.isShaderMaterial)&&O.setValue(z,`isOrthographic`,e.isOrthographicCamera===!0),M!==e&&(M=e,w=!0,E=!0)}if(v.needsLights&&(y.state.directionalShadowMap.length>0&&O.setValue(z,`directionalShadowMap`,y.state.directionalShadowMap,H),y.state.spotShadowMap.length>0&&O.setValue(z,`spotShadowMap`,y.state.spotShadowMap,H),y.state.pointShadowMap.length>0&&O.setValue(z,`pointShadowMap`,y.state.pointShadowMap,H)),i.isSkinnedMesh){O.setOptional(z,i,`bindMatrix`),O.setOptional(z,i,`bindMatrixInverse`);let e=i.skeleton;e&&(e.boneTexture===null&&e.computeBoneTexture(),O.setValue(z,`boneTexture`,e.boneTexture,H))}i.isBatchedMesh&&(O.setOptional(z,i,`batchingTexture`),O.setValue(z,`batchingTexture`,i._matricesTexture,H),O.setOptional(z,i,`batchingIdTexture`),O.setValue(z,`batchingIdTexture`,i._indirectTexture,H),O.setOptional(z,i,`batchingColorTexture`),i._colorsTexture!==null&&O.setValue(z,`batchingColorTexture`,i._colorsTexture,H));let N=n.morphAttributes;if((N.position!==void 0||N.normal!==void 0||N.color!==void 0)&&je.update(i,n,S),(w||v.receiveShadow!==i.receiveShadow)&&(v.receiveShadow=i.receiveShadow,O.setValue(z,`receiveShadow`,i.receiveShadow)),(r.isMeshStandardMaterial||r.isMeshLambertMaterial||r.isMeshPhongMaterial)&&r.envMap===null&&t.environment!==null&&(k.envMapIntensity.value=t.environmentIntensity),k.dfgLUT!==void 0&&(k.dfgLUT.value=Gm()),w){if(O.setValue(z,`toneMappingExposure`,T.toneMappingExposure),v.needsLights&&st(k,E),a&&r.fog===!0&&Te.refreshFogUniforms(k,a),Te.refreshMaterialUniforms(k,r,R,te,x.state.transmissionRenderTarget[e.id]),v.needsLights&&v.lightProbeGrid){let e=v.lightProbeGrid;k.probesSH.value=e.texture,k.probesMin.value.copy(e.boundingBox.min),k.probesMax.value.copy(e.boundingBox.max),k.probesResolution.value.copy(e.resolution)}wp.upload(z,rt(v),k,H)}if(r.isShaderMaterial&&r.uniformsNeedUpdate===!0&&(wp.upload(z,rt(v),k,H),r.uniformsNeedUpdate=!1),r.isSpriteMaterial&&O.setValue(z,`center`,i.center),O.setValue(z,`modelViewMatrix`,i.modelViewMatrix),O.setValue(z,`normalMatrix`,i.normalMatrix),O.setValue(z,`modelMatrix`,i.matrixWorld),r.uniformsGroups!==void 0){let e=r.uniformsGroups;for(let t=0,n=e.length;t<n;t++){let n=e[t];Ie.update(n,S),Ie.bind(n,S)}}return S}function st(e,t){e.ambientLightColor.needsUpdate=t,e.lightProbe.needsUpdate=t,e.directionalLights.needsUpdate=t,e.directionalLightShadows.needsUpdate=t,e.pointLights.needsUpdate=t,e.pointLightShadows.needsUpdate=t,e.spotLights.needsUpdate=t,e.spotLightShadows.needsUpdate=t,e.rectAreaLights.needsUpdate=t,e.hemisphereLights.needsUpdate=t}function ct(e){return e.isMeshLambertMaterial||e.isMeshToonMaterial||e.isMeshPhongMaterial||e.isMeshStandardMaterial||e.isShadowMaterial||e.isShaderMaterial&&e.lights===!0}this.getActiveCubeFace=function(){return O},this.getActiveMipmapLevel=function(){return k},this.getRenderTarget=function(){return A},this.setRenderTargetTextures=function(e,t,n){let r=V.get(e);r.__autoAllocateDepthBuffer=e.resolveDepthBuffer===!1,r.__autoAllocateDepthBuffer===!1&&(r.__useRenderToTexture=!1),V.get(e.texture).__webglTexture=t,V.get(e.depthTexture).__webglTexture=r.__autoAllocateDepthBuffer?void 0:n,r.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(e,t){let n=V.get(e);n.__webglFramebuffer=t,n.__useDefaultFramebuffer=t===void 0};let lt=z.createFramebuffer();this.setRenderTarget=function(e,t=0,n=0){A=e,O=t,k=n;let r=null,i=!1,a=!1;if(e){let o=V.get(e);if(o.__useDefaultFramebuffer!==void 0){B.bindFramebuffer(z.FRAMEBUFFER,o.__webglFramebuffer),N.copy(e.viewport),P.copy(e.scissor),F=e.scissorTest,B.viewport(N),B.scissor(P),B.setScissorTest(F),j=-1;return}else if(o.__webglFramebuffer===void 0)H.setupRenderTarget(e);else if(o.__hasExternalTextures)H.rebindTextures(e,V.get(e.texture).__webglTexture,V.get(e.depthTexture).__webglTexture);else if(e.depthBuffer){let t=e.depthTexture;if(o.__boundDepthTexture!==t){if(t!==null&&V.has(t)&&(e.width!==t.image.width||e.height!==t.image.height))throw Error(`WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.`);H.setupDepthRenderbuffer(e)}}let s=e.texture;(s.isData3DTexture||s.isDataArrayTexture||s.isCompressedArrayTexture)&&(a=!0);let c=V.get(e).__webglFramebuffer;e.isWebGLCubeRenderTarget?(r=Array.isArray(c[t])?c[t][n]:c[t],i=!0):r=e.samples>0&&H.useMultisampledRTT(e)===!1?V.get(e).__webglMultisampledFramebuffer:Array.isArray(c)?c[n]:c,N.copy(e.viewport),P.copy(e.scissor),F=e.scissorTest}else N.copy(ie).multiplyScalar(R).floor(),P.copy(ae).multiplyScalar(R).floor(),F=oe;if(n!==0&&(r=lt),B.bindFramebuffer(z.FRAMEBUFFER,r)&&B.drawBuffers(e,r),B.viewport(N),B.scissor(P),B.setScissorTest(F),i){let r=V.get(e.texture);z.framebufferTexture2D(z.FRAMEBUFFER,z.COLOR_ATTACHMENT0,z.TEXTURE_CUBE_MAP_POSITIVE_X+t,r.__webglTexture,n)}else if(a){let r=t;for(let t=0;t<e.textures.length;t++){let i=V.get(e.textures[t]);z.framebufferTextureLayer(z.FRAMEBUFFER,z.COLOR_ATTACHMENT0+t,i.__webglTexture,n,r)}}else if(e!==null&&n!==0){let t=V.get(e.texture);z.framebufferTexture2D(z.FRAMEBUFFER,z.COLOR_ATTACHMENT0,z.TEXTURE_2D,t.__webglTexture,n)}j=-1},this.readRenderTargetPixels=function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget)){K(`WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);return}let c=V.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c){B.bindFramebuffer(z.FRAMEBUFFER,c);try{let o=e.textures[s],c=o.format,l=o.type;if(e.textures.length>1&&z.readBuffer(z.COLOR_ATTACHMENT0+s),!ve.textureFormatReadable(c)){K(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.`);return}if(!ve.textureTypeReadable(l)){K(`WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.`);return}t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i&&z.readPixels(t,n,r,i,Pe.convert(c),Pe.convert(l),a)}finally{let e=A===null?null:V.get(A).__webglFramebuffer;B.bindFramebuffer(z.FRAMEBUFFER,e)}}},this.readRenderTargetPixelsAsync=async function(e,t,n,r,i,a,o,s=0){if(!(e&&e.isWebGLRenderTarget))throw Error(`THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.`);let c=V.get(e).__webglFramebuffer;if(e.isWebGLCubeRenderTarget&&o!==void 0&&(c=c[o]),c)if(t>=0&&t<=e.width-r&&n>=0&&n<=e.height-i){B.bindFramebuffer(z.FRAMEBUFFER,c);let o=e.textures[s],l=o.format,u=o.type;if(e.textures.length>1&&z.readBuffer(z.COLOR_ATTACHMENT0+s),!ve.textureFormatReadable(l))throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.`);if(!ve.textureTypeReadable(u))throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.`);let d=z.createBuffer();z.bindBuffer(z.PIXEL_PACK_BUFFER,d),z.bufferData(z.PIXEL_PACK_BUFFER,a.byteLength,z.STREAM_READ),z.readPixels(t,n,r,i,Pe.convert(l),Pe.convert(u),0);let f=A===null?null:V.get(A).__webglFramebuffer;B.bindFramebuffer(z.FRAMEBUFFER,f);let p=z.fenceSync(z.SYNC_GPU_COMMANDS_COMPLETE,0);return z.flush(),await Mo(z,p,4),z.bindBuffer(z.PIXEL_PACK_BUFFER,d),z.getBufferSubData(z.PIXEL_PACK_BUFFER,0,a),z.deleteBuffer(d),z.deleteSync(p),a}else throw Error(`THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.`)},this.copyFramebufferToTexture=function(e,t=null,n=0){let r=2**-n,i=Math.floor(e.image.width*r),a=Math.floor(e.image.height*r),o=t===null?0:t.x,s=t===null?0:t.y;H.setTexture2D(e,0),z.copyTexSubImage2D(z.TEXTURE_2D,n,0,0,o,s,i,a),B.unbindTexture()};let ut=z.createFramebuffer(),dt=z.createFramebuffer();this.copyTextureToTexture=function(e,t,n=null,r=null,i=0,a=0){let o,s,c,l,u,d,f,p,m,h=e.isCompressedTexture?e.mipmaps[a]:e.image;if(n!==null)o=n.max.x-n.min.x,s=n.max.y-n.min.y,c=n.isBox3?n.max.z-n.min.z:1,l=n.min.x,u=n.min.y,d=n.isBox3?n.min.z:0;else{let t=2**-i;o=Math.floor(h.width*t),s=Math.floor(h.height*t),c=e.isDataArrayTexture?h.depth:e.isData3DTexture?Math.floor(h.depth*t):1,l=0,u=0,d=0}r===null?(f=0,p=0,m=0):(f=r.x,p=r.y,m=r.z);let g=Pe.convert(t.format),_=Pe.convert(t.type),v;t.isData3DTexture?(H.setTexture3D(t,0),v=z.TEXTURE_3D):t.isDataArrayTexture||t.isCompressedArrayTexture?(H.setTexture2DArray(t,0),v=z.TEXTURE_2D_ARRAY):(H.setTexture2D(t,0),v=z.TEXTURE_2D),B.activeTexture(z.TEXTURE0),B.pixelStorei(z.UNPACK_FLIP_Y_WEBGL,t.flipY),B.pixelStorei(z.UNPACK_PREMULTIPLY_ALPHA_WEBGL,t.premultiplyAlpha),B.pixelStorei(z.UNPACK_ALIGNMENT,t.unpackAlignment);let y=B.getParameter(z.UNPACK_ROW_LENGTH),b=B.getParameter(z.UNPACK_IMAGE_HEIGHT),x=B.getParameter(z.UNPACK_SKIP_PIXELS),S=B.getParameter(z.UNPACK_SKIP_ROWS),C=B.getParameter(z.UNPACK_SKIP_IMAGES);B.pixelStorei(z.UNPACK_ROW_LENGTH,h.width),B.pixelStorei(z.UNPACK_IMAGE_HEIGHT,h.height),B.pixelStorei(z.UNPACK_SKIP_PIXELS,l),B.pixelStorei(z.UNPACK_SKIP_ROWS,u),B.pixelStorei(z.UNPACK_SKIP_IMAGES,d);let w=e.isDataArrayTexture||e.isData3DTexture,T=t.isDataArrayTexture||t.isData3DTexture;if(e.isDepthTexture){let n=V.get(e),r=V.get(t),h=V.get(n.__renderTarget),g=V.get(r.__renderTarget);B.bindFramebuffer(z.READ_FRAMEBUFFER,h.__webglFramebuffer),B.bindFramebuffer(z.DRAW_FRAMEBUFFER,g.__webglFramebuffer);for(let n=0;n<c;n++)w&&(z.framebufferTextureLayer(z.READ_FRAMEBUFFER,z.COLOR_ATTACHMENT0,V.get(e).__webglTexture,i,d+n),z.framebufferTextureLayer(z.DRAW_FRAMEBUFFER,z.COLOR_ATTACHMENT0,V.get(t).__webglTexture,a,m+n)),z.blitFramebuffer(l,u,o,s,f,p,o,s,z.DEPTH_BUFFER_BIT,z.NEAREST);B.bindFramebuffer(z.READ_FRAMEBUFFER,null),B.bindFramebuffer(z.DRAW_FRAMEBUFFER,null)}else if(i!==0||e.isRenderTargetTexture||V.has(e)){let n=V.get(e),r=V.get(t);B.bindFramebuffer(z.READ_FRAMEBUFFER,ut),B.bindFramebuffer(z.DRAW_FRAMEBUFFER,dt);for(let e=0;e<c;e++)w?z.framebufferTextureLayer(z.READ_FRAMEBUFFER,z.COLOR_ATTACHMENT0,n.__webglTexture,i,d+e):z.framebufferTexture2D(z.READ_FRAMEBUFFER,z.COLOR_ATTACHMENT0,z.TEXTURE_2D,n.__webglTexture,i),T?z.framebufferTextureLayer(z.DRAW_FRAMEBUFFER,z.COLOR_ATTACHMENT0,r.__webglTexture,a,m+e):z.framebufferTexture2D(z.DRAW_FRAMEBUFFER,z.COLOR_ATTACHMENT0,z.TEXTURE_2D,r.__webglTexture,a),i===0?T?z.copyTexSubImage3D(v,a,f,p,m+e,l,u,o,s):z.copyTexSubImage2D(v,a,f,p,l,u,o,s):z.blitFramebuffer(l,u,o,s,f,p,o,s,z.COLOR_BUFFER_BIT,z.NEAREST);B.bindFramebuffer(z.READ_FRAMEBUFFER,null),B.bindFramebuffer(z.DRAW_FRAMEBUFFER,null)}else T?e.isDataTexture||e.isData3DTexture?z.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h.data):t.isCompressedArrayTexture?z.compressedTexSubImage3D(v,a,f,p,m,o,s,c,g,h.data):z.texSubImage3D(v,a,f,p,m,o,s,c,g,_,h):e.isDataTexture?z.texSubImage2D(z.TEXTURE_2D,a,f,p,o,s,g,_,h.data):e.isCompressedTexture?z.compressedTexSubImage2D(z.TEXTURE_2D,a,f,p,h.width,h.height,g,h.data):z.texSubImage2D(z.TEXTURE_2D,a,f,p,o,s,g,_,h);B.pixelStorei(z.UNPACK_ROW_LENGTH,y),B.pixelStorei(z.UNPACK_IMAGE_HEIGHT,b),B.pixelStorei(z.UNPACK_SKIP_PIXELS,x),B.pixelStorei(z.UNPACK_SKIP_ROWS,S),B.pixelStorei(z.UNPACK_SKIP_IMAGES,C),a===0&&t.generateMipmaps&&z.generateMipmap(v),B.unbindTexture()},this.initRenderTarget=function(e){V.get(e).__webglFramebuffer===void 0&&H.setupRenderTarget(e)},this.initTexture=function(e){e.isCubeTexture?H.setTextureCube(e,0):e.isData3DTexture?H.setTexture3D(e,0):e.isDataArrayTexture||e.isCompressedArrayTexture?H.setTexture2DArray(e,0):H.setTexture2D(e,0),B.unbindTexture()},this.resetState=function(){O=0,k=0,A=null,B.reset(),Fe.reset()},typeof __THREE_DEVTOOLS__<`u`&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent(`observe`,{detail:this}))}get coordinateSystem(){return So}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;let t=this.getContext();t.drawingBufferColorSpace=hs._getDrawingBufferColorSpace(e),t.unpackColorSpace=hs._getUnpackColorSpace()}},qm={type:`change`},Jm={type:`start`},Ym={type:`end`},Xm=new _l,Zm=new Kl,Qm=Math.cos(70*ss.DEG2RAD),$m=new J,eh=2*Math.PI,th={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},nh=1e-6,rh=class extends Ed{constructor(e,t=null){super(e,t),this.state=th.NONE,this.target=new J,this.cursor=new J,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:`ArrowLeft`,UP:`ArrowUp`,RIGHT:`ArrowRight`,BOTTOM:`ArrowDown`},this.mouseButtons={LEFT:Gi.ROTATE,MIDDLE:Gi.DOLLY,RIGHT:Gi.PAN},this.touches={ONE:Ki.ROTATE,TWO:Ki.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._cursorStyle=`auto`,this._domElementKeyEvents=null,this._lastPosition=new J,this._lastQuaternion=new cs,this._lastTargetPosition=new J,this._quat=new cs().setFromUnitVectors(e.up,new J(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new Td,this._sphericalDelta=new Td,this._scale=1,this._panOffset=new J,this._rotateStart=new q,this._rotateEnd=new q,this._rotateDelta=new q,this._panStart=new q,this._panEnd=new q,this._panDelta=new q,this._dollyStart=new q,this._dollyEnd=new q,this._dollyDelta=new q,this._dollyDirection=new J,this._mouse=new q,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=ah.bind(this),this._onPointerDown=ih.bind(this),this._onPointerUp=oh.bind(this),this._onContextMenu=ph.bind(this),this._onMouseWheel=lh.bind(this),this._onKeyDown=uh.bind(this),this._onTouchStart=dh.bind(this),this._onTouchMove=fh.bind(this),this._onMouseDown=sh.bind(this),this._onMouseMove=ch.bind(this),this._interceptControlDown=mh.bind(this),this._interceptControlUp=hh.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}set cursorStyle(e){this._cursorStyle=e,e===`grab`?this.domElement.style.cursor=`grab`:this.domElement.style.cursor=`auto`}get cursorStyle(){return this._cursorStyle}connect(e){super.connect(e),this.domElement.addEventListener(`pointerdown`,this._onPointerDown),this.domElement.addEventListener(`pointercancel`,this._onPointerUp),this.domElement.addEventListener(`contextmenu`,this._onContextMenu),this.domElement.addEventListener(`wheel`,this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener(`keydown`,this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction=`none`}disconnect(){this.domElement.removeEventListener(`pointerdown`,this._onPointerDown),this.domElement.ownerDocument.removeEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.removeEventListener(`pointerup`,this._onPointerUp),this.domElement.removeEventListener(`pointercancel`,this._onPointerUp),this.domElement.removeEventListener(`wheel`,this._onMouseWheel),this.domElement.removeEventListener(`contextmenu`,this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener(`keydown`,this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction=``}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener(`keydown`,this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener(`keydown`,this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(qm),this.update(),this.state=th.NONE}pan(e,t){this._pan(e,t),this.update()}dollyIn(e){this._dollyIn(e),this.update()}dollyOut(e){this._dollyOut(e),this.update()}rotateLeft(e){this._rotateLeft(e),this.update()}rotateUp(e){this._rotateUp(e),this.update()}update(e=null){let t=this.object.position;$m.copy(t).sub(this.target),$m.applyQuaternion(this._quat),this._spherical.setFromVector3($m),this.autoRotate&&this.state===th.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let n=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(n)&&isFinite(r)&&(n<-Math.PI?n+=eh:n>Math.PI&&(n-=eh),r<-Math.PI?r+=eh:r>Math.PI&&(r-=eh),n<=r?this._spherical.theta=Math.max(n,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(n+r)/2?Math.max(n,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let i=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{let e=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),i=e!=this._spherical.radius}if($m.setFromSpherical(this._spherical),$m.applyQuaternion(this._quatInverse),t.copy(this.target).add($m),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let e=null;if(this.object.isPerspectiveCamera){let t=$m.length();e=this._clampDistance(t*this._scale);let n=t-e;this.object.position.addScaledVector(this._dollyDirection,n),this.object.updateMatrixWorld(),i=!!n}else if(this.object.isOrthographicCamera){let t=new J(this._mouse.x,this._mouse.y,0);t.unproject(this.object);let n=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),i=n!==this.object.zoom;let r=new J(this._mouse.x,this._mouse.y,0);r.unproject(this.object),this.object.position.sub(r).add(t),this.object.updateMatrixWorld(),e=$m.length()}else console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled.`),this.zoomToCursor=!1;e!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(e).add(this.object.position):(Xm.origin.copy(this.object.position),Xm.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Xm.direction))<Qm?this.object.lookAt(this.target):(Zm.setFromNormalAndCoplanarPoint(this.object.up,this.target),Xm.intersectPlane(Zm,this.target))))}else if(this.object.isOrthographicCamera){let e=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),e!==this.object.zoom&&(this.object.updateProjectionMatrix(),i=!0)}return this._scale=1,this._performCursorZoom=!1,i||this._lastPosition.distanceToSquared(this.object.position)>nh||8*(1-this._lastQuaternion.dot(this.object.quaternion))>nh||this._lastTargetPosition.distanceToSquared(this.target)>nh?(this.dispatchEvent(qm),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e===null?eh/60/60*this.autoRotateSpeed:eh/60*this.autoRotateSpeed*e}_getZoomScale(e){let t=Math.abs(e*.01);return .95**(this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){$m.setFromMatrixColumn(t,0),$m.multiplyScalar(-e),this._panOffset.add($m)}_panUp(e,t){this.screenSpacePanning===!0?$m.setFromMatrixColumn(t,1):($m.setFromMatrixColumn(t,0),$m.crossVectors(this.object.up,$m)),$m.multiplyScalar(e),this._panOffset.add($m)}_pan(e,t){let n=this.domElement;if(this.object.isPerspectiveCamera){let r=this.object.position;$m.copy(r).sub(this.target);let i=$m.length();i*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*i/n.clientHeight,this.object.matrix),this._panUp(2*t*i/n.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/n.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/n.clientHeight,this.object.matrix)):(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.`),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.`),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn(`WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.`),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;let n=this.domElement.getBoundingClientRect(),r=e-n.left,i=t-n.top,a=n.width,o=n.height;this._mouse.x=r/a*2-1,this._mouse.y=-(i/o)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(eh*this._rotateDelta.x/t.clientHeight),this._rotateUp(eh*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(eh*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-eh*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(eh*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-eh*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(n,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(n,r)}}_handleTouchStartDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,i=Math.sqrt(n*n+r*r);this._dollyStart.set(0,i)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateEnd.set(n,r)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);let t=this.domElement;this._rotateLeft(eh*this._rotateDelta.x/t.clientHeight),this._rotateUp(eh*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{let t=this._getSecondPointerPosition(e),n=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(n,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){let t=this._getSecondPointerPosition(e),n=e.pageX-t.x,r=e.pageY-t.y,i=Math.sqrt(n*n+r*r);this._dollyEnd.set(0,i),this._dollyDelta.set(0,(this._dollyEnd.y/this._dollyStart.y)**+this.zoomSpeed),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);let a=(e.pageX+t.x)*.5,o=(e.pageY+t.y)*.5;this._updateZoomParameters(a,o)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new q,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){let t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){let t=e.deltaMode,n={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:n.deltaY*=16;break;case 2:n.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(n.deltaY*=10),n}};function ih(e){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(e.pointerId),this.domElement.ownerDocument.addEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.addEventListener(`pointerup`,this._onPointerUp)),!this._isTrackingPointer(e)&&(this._addPointer(e),e.pointerType===`touch`?this._onTouchStart(e):this._onMouseDown(e),this._cursorStyle===`grab`&&(this.domElement.style.cursor=`grabbing`)))}function ah(e){this.enabled!==!1&&(e.pointerType===`touch`?this._onTouchMove(e):this._onMouseMove(e))}function oh(e){switch(this._removePointer(e),this._pointers.length){case 0:this.domElement.releasePointerCapture(e.pointerId),this.domElement.ownerDocument.removeEventListener(`pointermove`,this._onPointerMove),this.domElement.ownerDocument.removeEventListener(`pointerup`,this._onPointerUp),this.dispatchEvent(Ym),this.state=th.NONE,this._cursorStyle===`grab`&&(this.domElement.style.cursor=`grab`);break;case 1:let t=this._pointers[0],n=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:n.x,pageY:n.y});break}}function sh(e){let t;switch(e.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case Gi.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(e),this.state=th.DOLLY;break;case Gi.ROTATE:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=th.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=th.ROTATE}break;case Gi.PAN:if(e.ctrlKey||e.metaKey||e.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(e),this.state=th.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(e),this.state=th.PAN}break;default:this.state=th.NONE}this.state!==th.NONE&&this.dispatchEvent(Jm)}function ch(e){switch(this.state){case th.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(e);break;case th.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(e);break;case th.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(e);break}}function lh(e){this.enabled===!1||this.enableZoom===!1||this.state!==th.NONE||(e.preventDefault(),this.dispatchEvent(Jm),this._handleMouseWheel(this._customWheelEvent(e)),this.dispatchEvent(Ym))}function uh(e){this.enabled!==!1&&this._handleKeyDown(e)}function dh(e){switch(this._trackPointer(e),this._pointers.length){case 1:switch(this.touches.ONE){case Ki.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(e),this.state=th.TOUCH_ROTATE;break;case Ki.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(e),this.state=th.TOUCH_PAN;break;default:this.state=th.NONE}break;case 2:switch(this.touches.TWO){case Ki.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(e),this.state=th.TOUCH_DOLLY_PAN;break;case Ki.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(e),this.state=th.TOUCH_DOLLY_ROTATE;break;default:this.state=th.NONE}break;default:this.state=th.NONE}this.state!==th.NONE&&this.dispatchEvent(Jm)}function fh(e){switch(this._trackPointer(e),this.state){case th.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(e),this.update();break;case th.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(e),this.update();break;case th.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(e),this.update();break;case th.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(e),this.update();break;default:this.state=th.NONE}}function ph(e){this.enabled!==!1&&e.preventDefault()}function mh(e){e.key===`Control`&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener(`keyup`,this._interceptControlUp,{passive:!0,capture:!0}))}function hh(e){e.key===`Control`&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener(`keyup`,this._interceptControlUp,{passive:!0,capture:!0}))}var gh=new pc,_h=document.querySelector(`.hero-scene`)||document.getElementById(`root`)?.parentElement||document.body,vh=()=>_h.clientWidth||window.innerWidth,yh=()=>_h.clientHeight||window.innerHeight,bh=new Qu(40,vh()/yh(),.5,500);bh.position.set(30,30,66),bh.lookAt(0,6,0);function xh(){let e=vh(),t=yh(),n=-e*.18;bh.setViewOffset(e,t,n,0,e,t)}xh();function Sh(e){e.setSize(vh(),yh()),e.setPixelRatio(Math.min(window.devicePixelRatio,1.5)),e.toneMapping=4,e.toneMappingExposure=1.15,e.outputColorSpace=go,e.shadowMap.enabled=!0,e.shadowMap.type=3}var Ch=new Km({antialias:!0,alpha:!0,powerPreference:`high-performance`});Sh(Ch),Ch.setClearColor(0,0),(document.getElementById(`root`)??document.body).appendChild(Ch.domElement),gh.background=null;var wh=1,Th=wh,Eh=new cu(wh,wh,wh,1,1,1),Dh=[`#4a8c3f`,`#3d7a34`,`#5a9e4a`,`#2d6b24`,`#68ad58`,`#3f8535`,`#4d9040`,`#55a048`],Oh=[`#a0978a`,`#8c8478`,`#b5ad9e`,`#9a9184`,`#c2bab0`,`#7d756a`,`#bbb3a6`,`#938b7f`],kh=[`#4a3728`,`#3d2e20`,`#5c4535`,`#2e2218`,`#6b5444`],Ah=[`#e63c2e`,`#d4452f`,`#f05a3a`,`#c93525`,`#ff6b45`,`#e8502a`,`#d94a30`,`#f24832`,`#ff7f50`,`#e06030`],jh=[`#e63c2e`,`#f05a3a`,`#ff6b45`,`#f5a623`,`#ff8c42`,`#e8502a`],Mh=[],Nh={},Ph=new Set;function Fh(e,t,n){return`${Math.round(e*100)},${Math.round(t*100)},${Math.round(n*100)}`}function Ih(e){return e[Math.floor(Math.random()*e.length)]}function Lh(e,t,n,r,i){let a=Fh(e,t,n);if(Ph.has(a))return;Ph.add(a);let o=i||`default`;Nh[o]||(Nh[o]={geo:`voxel`,transforms:[],colors:[]}),Nh[o].transforms.push({x:e,y:t,z:n,rx:0,rz:0}),Nh[o].colors.push(r)}function Rh(e,t,n,r,i,a,o,s,c,l){let u=Fh(t,n,r);if(Ph.has(u))return;Ph.add(u);let d=l||`custom`,f=i.toFixed(2)+`_`+a.toFixed(2)+`_`+o.toFixed(2),p=d+`|`+f;Nh[p]||(Nh[p]={geo:f,transforms:[],colors:[]}),Nh[p].transforms.push({x:t,y:n,z:r,rx:s||0,rz:c||0}),Nh[p].colors.push(e)}var zh={voxel:Eh};function Bh(e,t,n,r){return e===`voxel`?Eh:(zh[e]||(zh[e]=new cu(wh*t,wh*n,wh*r)),zh[e])}var Vh={grass:{rough:.85,metal:.05,clearcoat:0,physical:!1},underside:{rough:.92,metal:.03,clearcoat:0,physical:!1},rock:{rough:.75,metal:.1,clearcoat:.3,physical:!0},trunk:{rough:.9,metal:.05,clearcoat:0,physical:!1},leaf:{rough:.7,metal:.05,clearcoat:.3,physical:!0},flower:{rough:.7,metal:0,clearcoat:0,physical:!1},grassTuft:{rough:.9,metal:0,clearcoat:0,physical:!1},mushroom:{rough:.8,metal:0,clearcoat:0,physical:!1}};function Hh(){let e=new ic,t=new X;for(let n in Nh){let r=Nh[n],i=r.transforms.length;if(i===0)continue;let a=Vh[n.split(`|`)[0]],o;a.physical?(o=new xu,o.clearcoat=a.clearcoat,o.clearcoatRoughness=.5,o.reflectivity=.3,o.ior=1.5):o=new bu,o.roughness=a.rough,o.metalness=a.metal,o.envMapIntensity=1.2,o.flatShading=!0,o.polygonOffset=!0,o.polygonOffsetFactor=1,o.polygonOffsetUnits=1;let s;if(r.geo===`voxel`)s=Eh;else{let e=r.geo.split(`_`).map(Number);s=Bh(r.geo,e[0],e[1],e[2])}let c=new Hl(s,o,i);c.name=`cat_`+n.replace(/[^a-zA-Z0-9]/g,`_`).slice(0,40),c.castShadow=!0,c.receiveShadow=!0;for(let n=0;n<i;n++){let i=r.transforms[n];e.position.set(i.x,i.y,i.z),e.rotation.set(i.rx,0,i.rz),e.updateMatrix(),c.setMatrixAt(n,e.matrix),t.set(r.colors[n]),c.setColorAt(n,t)}c.instanceMatrix.needsUpdate=!0,c.instanceColor.needsUpdate=!0,c.frustumCulled=!0,gh.add(c),Mh.push(c)}console.log(`Built ${Mh.length} instanced meshes from ${Object.keys(Nh).length} categories`)}var Uh=0,Wh=!1,Gh=1.8,Kh=[],qh=[];function Jh(e,t){return Math.sin(e*1.7+t*.9)*.4+Math.cos(t*2.1-e*.6)*.35+Math.sin((e+t)*1.1)*.25}var Yh=[`#8B6914`,`#7A5C12`,`#6B4E10`,`#9C7A1E`,`#5C4010`,`#A07828`,`#6E5518`],Xh=[`#706860`,`#5E564F`,`#887F75`,`#4D4640`,`#63594F`,`#7A7068`];for(let e=-8;e<=8;e++)for(let t=-6;t<=6;t++)Math.sqrt(e*e*.45+t*t*.55)<7.5+Jh(e,t)*1.5&&Kh.push({x:e,y:0,z:t,type:`grass`});for(let e=-9;e<=9;e++)for(let t=-7;t<=7;t++)Math.sqrt(e*e*.4+t*t*.5)<8.5+Jh(e*.7,t*.7)*1.2&&Kh.push({x:e,y:-1,z:t,type:`grass`});for(let e=-7;e<=6;e++)for(let t=-5;t<=5;t++)Math.sqrt(e*e*.5+t*t*.6)<6+Jh(e,t)*1.2&&Kh.push({x:e,y:1,z:t,type:`grass`});for(let e=-5;e<=4;e++)for(let t=-4;t<=3;t++)Math.sqrt(e*e*.55+t*t*.65)<4.5+Jh(e,t)*.9&&Kh.push({x:e,y:2,z:t,type:`grass`});for(let e=-4;e<=3;e++)for(let t=-3;t<=2;t++)Math.sqrt(e*e*.6+t*t*.7)<3.5+Jh(e,t)*.7&&Kh.push({x:e,y:3,z:t,type:`grass`});for(let e=-3;e<=2;e++)for(let t=-2;t<=2;t++)Math.sqrt(e*e*.7+t*t*.8)<2.8+Jh(e,t)*.5&&Kh.push({x:e,y:4,z:t,type:`grass`});for(let e=-2;e<=1;e++)for(let t=-1;t<=1;t++)Math.sqrt(e*e+t*t)<2&&Kh.push({x:e,y:5,z:t,type:`grass`});for(let e=-1;e<=0;e++)for(let t=-1;t<=0;t++)Kh.push({x:e,y:6,z:t,type:`grass`});for(let e=4;e<=8;e++)for(let t=-2;t<=3;t++){let n=e-6,r=t-.5,i=Math.sqrt(n*n+r*r);i<2.8+Jh(e,t)*.5&&Kh.push({x:e,y:1,z:t,type:`grass`}),i<2+Jh(e,t)*.3&&Kh.push({x:e,y:2,z:t,type:`grass`}),i<1.2&&Kh.push({x:e,y:3,z:t,type:`grass`})}for(let e=-6;e<=-3;e++)for(let t=-5;t<=-2;t++){let n=e+4.5,r=t+3.5,i=Math.sqrt(n*n+r*r);i<2+Jh(e,t)*.4&&Kh.push({x:e,y:1,z:t,type:`grass`}),i<1.2&&Kh.push({x:e,y:2,z:t,type:`grass`})}for(let e=-2;e>=-14;e--){let t=Math.abs(e+1),n=Math.max(.5,8.5-t*.55+Math.sin(t*.8)*.8),r=Math.sin(t*.7)*.4,i=Math.cos(t*.9)*.3;for(let a=-10;a<=10;a++)for(let o=-8;o<=8;o++){let s=a-r,c=o-i;if(Math.sqrt(s*s*.45+c*c*.55)<n+Jh(a*.8+t*.3,o*.8-t*.2)*(1+t*.08)){let n=t<4;qh.push({x:a,y:e,z:o,type:n?`dirt`:`stone`})}}}[{cx:0,cz:0,length:4,r:1.2},{cx:-3,cz:-1,length:3,r:.9},{cx:2,cz:2,length:3,r:.8},{cx:-1,cz:-3,length:2,r:.7},{cx:3,cz:-2,length:2,r:.6},{cx:-4,cz:1,length:2,r:.7},{cx:1,cz:-4,length:2,r:.5},{cx:-2,cz:3,length:3,r:.8}].forEach(e=>{for(let t=-14;t>=-14-e.length;t--){let n=Math.abs(t+14),r=Math.max(.3,e.r-n*.25);for(let i=Math.floor(e.cx-r-1);i<=Math.ceil(e.cx+r+1);i++)for(let a=Math.floor(e.cz-r-1);a<=Math.ceil(e.cz+r+1);a++){let o=i-e.cx,s=a-e.cz;Math.sqrt(o*o+s*s)<r+Jh(i+n,a-n)*.3&&qh.push({x:i,y:t,z:a,type:`stone`})}}}),qh.forEach(e=>{let t=e.type===`dirt`?Ih(Yh):Ih(Xh);Lh(e.x*Th,e.y*Th+wh/2,e.z*Th,t,`underside`)}),Kh.forEach(e=>{let t=Ih(Dh);Lh(e.x*Th,e.y*Th+wh/2,e.z*Th,t,`grass`)});var Zh=[{x:-2,y:5,z:-1},{x:-1,y:5,z:-1},{x:0,y:5,z:-1},{x:1,y:5,z:-1},{x:-2,y:5,z:0},{x:-1,y:5,z:0},{x:0,y:5,z:0},{x:1,y:5,z:0},{x:-1,y:5,z:1},{x:0,y:5,z:1},{x:1,y:5,z:1},{x:-2,y:5,z:1},{x:-1,y:6,z:-1},{x:0,y:6,z:-1},{x:1,y:6,z:-1},{x:-2,y:6,z:0},{x:-1,y:6,z:0},{x:0,y:6,z:0},{x:1,y:6,z:0},{x:-1,y:6,z:1},{x:0,y:6,z:1},{x:-2,y:6,z:-1},{x:-1,y:7,z:-1},{x:0,y:7,z:-1},{x:-1,y:7,z:0},{x:0,y:7,z:0},{x:1,y:7,z:0},{x:0,y:7,z:1},{x:-1,y:7,z:1},{x:0,y:8,z:0},{x:-1,y:8,z:0},{x:0,y:8,z:-1},{x:-1,y:8,z:-1},{x:3,y:2,z:2},{x:3,y:3,z:2},{x:4,y:1,z:-1},{x:4,y:2,z:-1},{x:-4,y:1,z:-2},{x:-4,y:2,z:-2},{x:-3,y:2,z:2},{x:-3,y:3,z:2},{x:5,y:1,z:1},{x:5,y:1,z:0},{x:-5,y:1,z:0},{x:2,y:3,z:-2},{x:2,y:4,z:-2},{x:-3,y:3,z:-1},{x:6,y:1,z:-2},{x:-6,y:0,z:2},{x:1,y:4,z:2},{x:-2,y:4,z:-2},{x:3,y:1,z:-3},{x:-2,y:1,z:3},{x:6,y:2,z:0},{x:6,y:3,z:0},{x:7,y:2,z:1}];Zh.forEach(e=>{let t=Ih(Oh);Lh(e.x*Th,e.y*Th+wh/2,e.z*Th,t,`rock`)}),[{x:0,y:9,z:0},{x:-1,y:9,z:0},{x:0,y:9,z:-1},{x:-1,y:9,z:-1},{x:0,y:10,z:0},{x:-1,y:10,z:0},{x:0,y:10,z:-1},{x:-1,y:10,z:-1},{x:0,y:11,z:0},{x:-1,y:11,z:0},{x:0,y:11,z:-1},{x:0,y:12,z:0},{x:-1,y:12,z:0},{x:0,y:12,z:-1},{x:0,y:13,z:0},{x:-1,y:13,z:0},{x:0,y:14,z:0},{x:-1,y:14,z:0},{x:0,y:15,z:0},{x:0,y:16,z:0},{x:-2,y:15,z:0},{x:-3,y:15,z:0},{x:-3,y:16,z:0},{x:-4,y:16,z:0},{x:-4,y:16,z:1},{x:-5,y:17,z:0},{x:-5,y:17,z:1},{x:1,y:14,z:0},{x:2,y:14,z:0},{x:2,y:15,z:0},{x:3,y:15,z:0},{x:3,y:16,z:0},{x:4,y:16,z:0},{x:4,y:17,z:0},{x:5,y:17,z:-1},{x:0,y:14,z:1},{x:0,y:15,z:1},{x:0,y:15,z:2},{x:1,y:16,z:2},{x:1,y:16,z:3},{x:0,y:13,z:-1},{x:0,y:14,z:-2},{x:0,y:15,z:-2},{x:-1,y:15,z:-2},{x:-1,y:16,z:-3},{x:0,y:16,z:-3},{x:0,y:17,z:0},{x:0,y:18,z:0},{x:1,y:13,z:-1},{x:-2,y:14,z:-1},{x:2,y:16,z:1},{x:-3,y:17,z:-1},{x:1,y:8,z:0},{x:-2,y:8,z:0},{x:0,y:8,z:1},{x:-1,y:8,z:-1},{x:1,y:7,z:1},{x:-2,y:7,z:-1}].forEach(e=>{let t=Ih(kh);Lh(e.x*Th,e.y*Th+wh/2,e.z*Th,t,`trunk`)});var Qh=[],$h=new Set;function eg(e,t,n){let r=`${e},${t},${n}`;$h.has(r)||($h.add(r),Qh.push({x:e,y:t,z:n}))}var tg=6.5,ng=tg/4.5;for(let e=-8;e<=8;e++)for(let t=15;t<=26;t++)for(let n=-7;n<=7;n++){let r=(t-20)*ng;Math.sqrt(e*e+r*r+n*n)<tg+(Math.sin(e*1.8+n*1.4)*.7+Math.cos(t*1.1+e*.7)*.6+Math.sin(n*2.3-t*.5)*.4)&&Math.random()>.18&&eg(e,t,n)}[{cx:-5,cy:17,cz:0,r:3.5},{cx:-5,cy:17,cz:1,r:2.8},{cx:5,cy:17,cz:-1,r:3.5},{cx:4,cy:18,cz:0,r:3},{cx:1,cy:17,cz:3,r:3.2},{cx:1,cy:17,cz:-3,r:3},{cx:-1,cy:17,cz:-3,r:2.8},{cx:0,cy:24,cz:0,r:3},{cx:-2,cy:23,cz:1,r:2.5},{cx:2,cy:23,cz:-1,r:2.5},{cx:1,cy:24,cz:1,r:2},{cx:-1,cy:24,cz:-1,r:2},{cx:-7,cy:18,cz:0,r:2},{cx:6,cy:18,cz:0,r:2},{cx:0,cy:18,cz:5,r:2.2},{cx:0,cy:18,cz:-5,r:2.2},{cx:-3,cy:15,cz:2,r:2.5},{cx:3,cy:15,cz:-2,r:2.5},{cx:-2,cy:15,cz:-3,r:2},{cx:2,cy:15,cz:3,r:2}].forEach(e=>{for(let t=Math.floor(e.cx-e.r-1);t<=Math.ceil(e.cx+e.r+1);t++)for(let n=Math.floor(e.cy-e.r);n<=Math.ceil(e.cy+e.r+1);n++)for(let r=Math.floor(e.cz-e.r-1);r<=Math.ceil(e.cz+e.r+1);r++){let i=t-e.cx,a=(n-e.cy)*1.15,o=r-e.cz;Math.sqrt(i*i+a*a+o*o)<e.r&&Math.random()>.2&&eg(t,n,r)}});for(let e=0;e<25;e++){let e=Math.round((Math.random()-.5)*14),t=Math.round((Math.random()-.5)*10);eg(e,Math.floor(Math.random()*3)+1,t)}Qh.forEach(e=>{let t=Ih(Ah);Lh(e.x*Th,e.y*Th+wh/2,e.z*Th,t,`leaf`)});var rg={};Kh.forEach(e=>{let t=`${e.x},${e.z}`;(!rg[t]||e.y>rg[t])&&(rg[t]=e.y)});var ig=[`#3a8530`,`#4a9540`,`#2d7020`,`#5aad50`,`#3d8a35`],ag=new Set(Zh.map(e=>`${e.x},${e.z}`));Object.entries(rg).forEach(([e,t])=>{let[n,r]=e.split(`,`).map(Number),i=ag.has(e);if(!i&&Math.random()<.4){let e=Math.random()<.3?2:1;for(let i=0;i<e;i++){let e=Ih(jh),i=(Math.random()-.5)*.5,a=(Math.random()-.5)*.5;Rh(e,n*Th+i,(t+1)*Th+wh*.22,r*Th+a,.35,.35,.35,0,0,`flower`)}}if(!i&&Math.random()<.3){let e=Ih(ig),i=(Math.random()-.5)*.6,a=(Math.random()-.5)*.6,o=(Math.random()-.5)*.15,s=(Math.random()-.5)*.15;Rh(e,n*Th+i,(t+1)*Th+wh*.32,r*Th+a,.25,.55,.25,o,s,`grassTuft`)}});var og=[`#f5e6c8`,`#e8d5b0`,`#d4c49a`,`#c9b88e`];Object.entries(rg).forEach(([e,t])=>{let[n,r]=e.split(`,`).map(Number);n<-2&&Math.random()<.15&&!ag.has(e)&&Rh(Ih(og),n*Th+(Math.random()-.5)*.3,(t+1)*Th+wh*.15,r*Th+(Math.random()-.5)*.3,.25,.22,.25,0,0,`mushroom`)}),Hh();var sg=new Map,cg=new Oc;{let e=new J;Mh.forEach(t=>{let n=t.count,r=t.instanceMatrix.array,i=new Float32Array(n*3),a=new Float32Array(n*3),o=new Float32Array(n*3);for(let t=0;t<n;t++){let n=t*16,a=r[n+12],s=r[n+13],c=r[n+14];i[t*3]=a,i[t*3+1]=s,i[t*3+2]=c,cg.expandByPoint(e.set(a,s,c));let l=Math.random()*Math.PI*2,u=Math.acos(2*Math.random()-1),d=Math.sin(u);o[t*3]=d*Math.cos(l),o[t*3+1]=d*Math.sin(l),o[t*3+2]=Math.cos(u)}sg.set(t,{origPositions:i,offsets:a,randDirs:o,count:n})}),cg.expandByScalar(3)}var lg=[];function ug(){let e=new Map,t=new X;return Mh.forEach(n=>{let r=n.count,i=new Float32Array(sg.get(n).origPositions),a=new Float32Array(r*3);for(let e=0;e<r;e++)n.getColorAt(e,t),a[e*3]=t.r,a[e*3+1]=t.g,a[e*3+2]=t.b;e.set(n,{positions:i,colors:a})}),e}lg[0]=ug();function dg(e){let t=e.name||``;return t.startsWith(`cat_leaf`)?`leaf`:t.startsWith(`cat_trunk`)?`trunk`:t.startsWith(`cat_grass`)?`grass`:t.startsWith(`cat_rock`)?`rock`:t.startsWith(`cat_underside`)?`underside`:t.startsWith(`cat_flower`)?`flower`:t.startsWith(`cat_mushroom`)?`mushroom`:`other`}function fg(){let e=new Map,t=new X,n=[`#e8f0e8`,`#d0e0d0`,`#c8dcc8`,`#f0f5f0`,`#dceadc`],r=[`#d0d0d0`,`#c0c0c0`,`#e0e0e0`,`#b8b8b8`,`#cccccc`],i=[`#1a4a2a`,`#224e30`,`#183e24`,`#2a5a38`,`#1e4828`,`#164020`],a=[`#3a2818`,`#2e2010`,`#4a3420`,`#342818`],o=[`#f0f5ff`,`#e8eeff`,`#ffffff`,`#f5f8ff`,`#eaf0ff`],s=[`#c8e0f8`,`#b0d0f0`,`#a8c8e8`],c=new Set;return Mh.forEach(l=>{let u=l.count,d=new Float32Array(u*3),f=new Float32Array(u*3),p=lg[0].get(l),m=p.positions,h=p.colors,g=dg(l);for(let e=0;e<u;e++){let l=m[e*3],u=m[e*3+1],p=m[e*3+2],_=h[e*3],v=h[e*3+1],y=h[e*3+2],b=l,x=u,S=p;if(g===`leaf`){let e=(u-14)/12,n=Math.atan2(p,l),r=Math.sqrt(l*l+p*p),a=Math.floor(e*5),s=e*5-a,d=Math.max(.3,(5.5-a*1)*(1-s*.3)),f=Math.min(r,d)*(d/Math.max(3,r+1));b=Math.cos(n)*f*1.1,S=Math.sin(n)*f*1.1,x=u+e*2;let m=`${Math.round(b)},${Math.round(x)},${Math.round(S)}`,h=c.has(m);h||c.add(m);let g=h?.85:.25;b+=(Math.random()-.5)*g,x+=(Math.random()-.5)*g,S+=(Math.random()-.5)*g,s>.6||e>.8?(t.set(Ih(o)),_=t.r*.72,v=t.g*.72,y=t.b*.75):(t.set(Ih(i)),_=t.r,v=t.g,y=t.b)}else if(g===`trunk`)b=l*.7+(Math.random()-.5)*.15,S=p*.7+(Math.random()-.5)*.15,t.set(Ih(a)),_=t.r,v=t.g,y=t.b;else if(g===`grass`)b=l*.72,S=p*.72,x=u+Math.max(0,4-Math.abs(l)-Math.abs(p)*.5)*.18,t.set(Ih(n)),_=t.r*.82,v=t.g*.82,y=t.b*.84;else if(g===`rock`)Math.sqrt(l*l+p*p)<3.5&&(x=u+.35),t.set(Ih(Math.random()<.3?s:r)),_=t.r*.85,v=t.g*.85,y=t.b*.88;else if(g===`underside`){let e=Math.max(0,-u-1),n=1-Math.min(.55,e*.04);b=l*n,S=p*n,t.set(Ih(Xh)),_=t.r,v=t.g,y=t.b*1.05}d[e*3]=b,d[e*3+1]=x,d[e*3+2]=S,f[e*3]=_,f[e*3+1]=v,f[e*3+2]=y}e.set(l,{positions:d,colors:f})}),e}function pg(){let e=new Map,t=new X,n=[`#5a9e4a`,`#4a8c3f`,`#68ad58`,`#3d7a34`,`#55a048`],r=[`#a09888`,`#8c847a`,`#b5ada0`,`#9a9284`,`#706860`],i=[`#ffb7c5`,`#ff97b0`,`#ffc8d6`,`#ff85a0`,`#ffd0db`,`#ffa0b8`,`#ff90a8`,`#ffccd8`],a=[`#fff0f5`,`#ffe8ef`,`#fff5f8`,`#ffeef3`],o=[`#5c3a28`,`#4a2e1e`,`#6b4835`,`#3d2418`,`#7a5840`],s=[`#6b8c50`,`#5a7a40`,`#7a9c60`],c=new Set;return Mh.forEach(l=>{let u=l.count,d=new Float32Array(u*3),f=new Float32Array(u*3),p=lg[0].get(l),m=p.positions,h=p.colors,g=dg(l);for(let e=0;e<u;e++){let l=m[e*3],u=m[e*3+1],p=m[e*3+2],_=h[e*3],v=h[e*3+1],y=h[e*3+2],b=l,x=u,S=p;if(g===`leaf`){let e=(u-14)/12,n=Math.sqrt(l*l+p*p),r=1.3,o=n*.06;b=l*r,S=p*r,x=u-o-e*1.5;let s=`${Math.round(b)},${Math.round(x)},${Math.round(S)}`,d=c.has(s);d||c.add(s);let f=d?.85:.25;b+=(Math.random()-.5)*f,x+=(Math.random()-.5)*f,S+=(Math.random()-.5)*f,t.set(Ih(Math.random()<.15?a:i)),_=t.r,v=t.g,y=t.b}else if(g===`trunk`){let e=Math.sin(u*.15)*.8;b=l*.85+e+(Math.random()-.5)*.15,S=p*.85+(Math.random()-.5)*.15,t.set(Ih(o)),_=t.r,v=t.g,y=t.b}else if(g===`grass`)b=l*1.15,S=p*1.1,x=u*.65,t.set(Ih(Math.random()<.2?s:n)),_=t.r,v=t.g,y=t.b;else if(g===`rock`)b=l*1.2,S=p*1.2,x=u*.7,t.set(Ih(r)),_=t.r,v=t.g,y=t.b;else if(g===`flower`)t.set(Ih(i)),_=t.r,v=t.g,y=t.b;else if(g===`underside`){let e=Math.max(0,-u-1),n=1+Math.min(.3,e*.025);b=l*n,S=p*n,x=u*.55,t.set(Ih(Yh)),_=t.r,v=t.g,y=t.b}d[e*3]=b,d[e*3+1]=x,d[e*3+2]=S,f[e*3]=_,f[e*3+1]=v,f[e*3+2]=y}e.set(l,{positions:d,colors:f})}),e}function mg(){let e=new Map,t=new X,n=[`#3a322c`,`#4a4038`,`#52473e`,`#2e2620`,`#403631`],r=[`#6a5d52`,`#7a6d60`,`#5e524a`],i=[`#1c1410`,`#241a12`,`#2a1f17`,`#1a120e`],a=[`#4a5a30`,`#3d4e28`,`#5a6e3a`,`#445528`,`#506336`],o=[`#3a2a1c`,`#4a3828`,`#2e2218`,`#5c4530`,`#3e2c1e`,`#4f3a28`],s=[`#6a4f35`,`#75583c`,`#5e4530`],c=[`#c8b89a`,`#d4c4a0`,`#b8a888`,`#beae90`],l=[`#2d4a28`,`#1f3a1c`,`#244222`,`#2a4625`],u=[`#3a5e30`,`#345532`,`#406838`,`#3d6035`],d=[`#2a4625`,`#244222`,`#345532`,`#2f4f2a`],f=[`#456f3a`,`#5a8845`,`#4d7c40`,`#3f6638`],p=[`#8fb058`,`#a3c267`,`#7ea84a`,`#9bc05e`,`#86a850`],m=[`#9a5226`,`#8a4520`,`#7a3c1a`],h=[`#b04030`,`#933420`,`#a83b28`],g=1.8,_=6*g,v=3.5*g,y=-3*g,b=.3*g,x=[[1,-.6,0],[1,3,0],[1.4,4.5,.1],[3.6,5.4,.2],[3.8,7,.1],[3.2,9.5,0],[2,11.5,.1],[1.4,13,.3]].map(e=>[e[0]*g,e[1]*g,e[2]*g]),S=[],C=0;for(let e=1;e<x.length;++e){let t=x[e-1],n=x[e],r=n[0]-t[0],i=n[1]-t[1],a=n[2]-t[2],o=Math.sqrt(r*r+i*i+a*a);S.push(o),C+=o}let w=[0];for(let e=0;e<S.length;++e)w.push(w[e]+S[e]/C);let T=e=>{if(e<=0)return[...x[0]];if(e>=1)return[...x[x.length-1]];let t=0;for(;t<w.length-1&&w[t+1]<e;)t++;let n=w[t],r=w[t+1],i=(e-n)/(r-n),a=x[t],o=x[t+1];return[a[0]+(o[0]-a[0])*i,a[1]+(o[1]-a[1])*i,a[2]+(o[2]-a[2])*i]},E=[{cx:-5.5*g,cy:6*g,cz:.2*g,rx:4*g,ry:.75*g,rz:2.6*g},{cx:4.5*g,cy:8.8*g,cz:-.6*g,rx:3*g,ry:.7*g,rz:2.2*g},{cx:.3*g,cy:12.5*g,cz:.3*g,rx:4.6*g,ry:.95*g,rz:3*g}],D=[u,d,f],O=[{trunkT:.28,target:[E[0].cx+.8,E[0].cy+.4,E[0].cz],thickness:.75*g,arcY:-.4*g},{trunkT:.62,target:[E[1].cx-.7,E[1].cy+.1,E[1].cz],thickness:.65*g,arcY:.3*g},{trunkT:.93,target:[E[2].cx,E[2].cy-.4,E[2].cz],thickness:.55*g,arcY:.25*g}],k=O.map(e=>T(e.trunkT)),A=(e,t)=>{let n=k[e],r=O[e].target,i=Math.sin(t*Math.PI)*O[e].arcY;return[n[0]+(r[0]-n[0])*t,n[1]+(r[1]-n[1])*t+i,n[2]+(r[2]-n[2])*t]},j=(e,t,n)=>{let[r,i,a]=T(e),o=.85*g*Math.exp(-2*e),s=.55*g+o,c=Math.atan2(n,Math.abs(t)>.01?t:.01),l=Math.cos(c),u=Math.sin(c),d=l+u>.3;return[r+l*s+(Math.random()-.5)*.1*g,i+(Math.random()-.5)*.15*g,a+u*s+(Math.random()-.5)*.1*g,d]},M=(e,t,n,r)=>{let[i,a,o]=A(e,t),s=O[e].thickness*(1-t*.5),c=Math.atan2(r,Math.abs(n)>.01?n:.01),l=Math.cos(c),u=Math.sin(c),d=l+u>.3;return[i+l*s+(Math.random()-.5)*.1*g,a+(Math.random()-.5)*.1*g,o+u*s+(Math.random()-.5)*.1*g,d]},N=(e,t=null,n=null)=>{let r,i;t!==null&&n!==null?(r=Math.atan2(n,t),i=Math.min(1,Math.sqrt(t*t+n*n)/6.5)):(r=Math.random()*Math.PI*2,i=Math.sqrt(Math.random()));let a=Math.cos(r)*i*e.rx,o=Math.sin(r)*i*e.rz,s=(Math.random()-.5)*2*e.ry;return[e.cx+a+(Math.random()-.5)*.35*g,e.cy+s+(Math.random()-.5)*.25*g,e.cz+o+(Math.random()-.5)*.35*g]},P=(e,t,n)=>{let r=Math.min(1,Math.max(0,Math.abs(t+2)/12));if(r<.08){let t=Math.atan2(n,e),r=Math.cos(t),i=Math.sin(t);return[Math.abs(r)>Math.abs(i*_/v)?Math.sign(r)*_:r*v/Math.abs(i),b,Math.abs(i)>Math.abs(r*v/_)?Math.sign(i)*v:i*_/Math.abs(r)]}if(r>.85){let t=e/9*(_-.5*g),r=n/7*(v-.5*g);return[Math.max(-9.9,Math.min(_-.5*g,t)),y,Math.max(-5.3999999999999995,Math.min(v-.5*g,r))]}let i=Math.atan2(n,e),a=0-(r-.08)/.77*(0-y),o=Math.cos(i),s=Math.sin(i),c,l;return Math.abs(o)*v>Math.abs(s)*_?(c=Math.sign(o)*_,l=s/Math.abs(o)*_*(v/_),l=Math.max(-6.3,Math.min(v,l))):(l=Math.sign(s)*v,c=o/Math.abs(s)*v*(_/v),c=Math.max(-10.8,Math.min(_,c))),[c,a,l]},F=0,I=[[2.8*g,0,1.8*g],[-3.5*g,-.09000000000000002,1.5*g],[1.2*g,-.18,-2.1*g],[-1.5*g,.08999999999999997,-2.5*g],[4.2*g,-.18,.4*g],[-4.5*g,-.09000000000000002,-.5*g],[.3*g,-.18,2.6*g],[-2.8*g,0,2*g],[3.5*g,-.09000000000000002,-1.6*g],[-.5*g,-.18,-2.8*g],[5*g,-.18,2.4*g],[-5*g,-.09000000000000002,2.8*g]],ee=[...T(.18),.7*g];return Mh.forEach(u=>{let d=u.count,f=new Float32Array(d*3),y=new Float32Array(d*3),x=lg[0].get(u),S=x.positions,C=x.colors,w=dg(u),T=w===`grass`&&(u.name||``).startsWith(`cat_grassTuft`),k=w===`grass`&&!T;for(let e=0;e<d;e++){let u=S[e*3],d=S[e*3+1],x=S[e*3+2],A=C[e*3],L=C[e*3+1],te=C[e*3+2],R=u,ne=d,re=x;if(w===`underside`){let e=(u*13+d*7+x*11|0)&255;if(e<24){let e=Math.atan2(x,u),n=Math.cos(e),i=Math.sin(e),a=Math.abs(n)>_/v*Math.abs(i)?Math.sign(n)*_:n/Math.abs(i||1e-6)*v,o=Math.abs(i)>v/_*Math.abs(n)?Math.sign(i)*v:i/Math.abs(n||1e-6)*_;R=Math.max(-10.8,Math.min(_,a)),re=Math.max(-6.3,Math.min(v,o)),ne=b+(Math.random()-.5)*.1*g,t.set(Ih(r)),A=t.r,L=t.g,te=t.b}else if(e<128){let[e,r,i]=P(u,d,x);R=e+(Math.random()-.5)*.08*g,ne=r+(Math.random()-.5)*.08*g,re=i+(Math.random()-.5)*.08*g,t.set(Ih(n)),A=t.r,L=t.g,te=t.b}else R=(Math.random()-.5)*2*9.81,ne=-5.04+Math.random()*4.32,re=(Math.random()-.5)*2*5.31,t.set(Ih(n)),A=t.r*.5,L=t.g*.5,te=t.b*.5}else if(k){let e=u/9*(_-.5*g),n=x/7*(v-.5*g);R=Math.max(-9.9,Math.min(_-.5*g,e)),re=Math.max(-5.3999999999999995,Math.min(v-.5*g,n));let r=Math.min(1,Math.max(0,d/4));r>.4?(ne=-.54+(r-.4)*.4*g+(Math.random()-.5)*.1*g,t.set(Ih(a))):(ne=-2.16+r*.7*g+(Math.random()-.5)*.08*g,t.set(Ih(i))),R+=(Math.random()-.5)*.15*g,re+=(Math.random()-.5)*.15*g,A=t.r,L=t.g,te=t.b}else if(T){let e=Math.random()*Math.PI*2,n=Math.random();R=Math.cos(e)*n*(_-.6*g),re=Math.sin(e)*n*(v-.6*g),ne=-.27+Math.random()*.15*g,t.set(Ih(a)),A=t.r*1.05,L=t.g*1.05,te=t.b*.95}else if(w===`trunk`){let e=(u*17+d*23+x*13|0)&255,n=e>=179,r;if(n){let t=(e-179)%O.length,n=Math.min(1,Math.max(0,(d-7)/11));[R,ne,re,r]=M(t,n,u,x)}else{let e=Math.min(1,Math.max(0,(d-7)/11));[R,ne,re,r]=j(e,u,x)}t.set(Ih(r?s:o)),A=t.r,L=t.g,te=t.b}else if(w===`leaf`)if(Math.sqrt(u*u+x*x)<2.8){let e=(u*31+d*19+x*29|0)&255,n=e<140?-1:e<178?0:e<217?1:2,r;if(n===-1){let e=Math.random();[R,ne,re,r]=j(e,u,x)}else{let e=Math.random();[R,ne,re,r]=M(n,e,u,x)}t.set(Ih(r?s:o)),A=t.r,L=t.g,te=t.b}else{let e;e=d>=22?0:d<18?1:2;let n=E[e];[R,ne,re]=N(n,u,x);let r=Math.random(),i=e===2?.14:.06;r<.03?t.set(Ih(m)):r<.03+i?t.set(Ih(p)):r<.3+i?t.set(Ih(l)):t.set(Ih(D[e])),A=t.r,L=t.g,te=t.b}else if(w===`rock`){if(F<I.length){let[e,n,i]=I[F];R=e+(Math.random()-.5)*.2*g,ne=n+(Math.random()-.5)*.1*g,re=i+(Math.random()-.5)*.2*g,t.set(Ih(r)),A=t.r*.9,L=t.g*.9,te=t.b*.85}else if(F-I.length<5){let[e,n,r,i]=ee,a=Math.random()*Math.PI*2,o=i*(.3+Math.random()*.5);R=e+Math.cos(a)*o,re=r+Math.sin(a)*o,ne=n+(Math.random()-.5)*.4*g,t.set(Ih(c)),A=t.r*.85,L=t.g*.85,te=t.b*.85}else{let e=Math.random()*Math.PI*2,n=Math.sqrt(Math.random());R=Math.cos(e)*n*(_-.5*g),re=Math.sin(e)*n*(v-.5*g),ne=-.27+(Math.random()-.5)*.1*g,t.set(Ih(r)),A=t.r*.85,L=t.g*.85,te=t.b*.8}F++}else if(w===`flower`){let e=Math.floor(Math.random()*E.length);[R,ne,re]=N(E[e]),Math.random()<.3?t.set(Ih(h)):t.set(Ih(D[e])),A=t.r,L=t.g,te=t.b}else if(w===`mushroom`){let e=Math.random(),n=e<.45?0:e<.75?1:2;[R,ne,re]=N(E[n]),t.set(Ih(D[n])),A=t.r,L=t.g,te=t.b}f[e*3]=R,f[e*3+1]=ne,f[e*3+2]=re,y[e*3]=A,y[e*3+1]=L,y[e*3+2]=te}e.set(u,{positions:f,colors:y})}),e}var hg=[null,fg,pg,mg];function gg(e){return lg[e]||(lg[e]=hg[e]()),lg[e]}function _g(e){let t=gg(e),n=new X;Mh.forEach(e=>{let r=sg.get(e),i=t.get(e),a=e.instanceMatrix.array,o=r.origPositions,s=r.offsets,c=r.count,l=i.positions,u=i.colors;for(let t=0;t<c;t++){let r=t*3;o[r]=l[r],o[r+1]=l[r+1],o[r+2]=l[r+2];let i=t*16;a[i+12]=l[r]+s[r],a[i+13]=l[r+1]+s[r+1],a[i+14]=l[r+2]+s[r+2],n.setRGB(u[r],u[r+1],u[r+2]),e.setColorAt(t,n)}e.instanceMatrix.needsUpdate=!0,e.instanceColor.needsUpdate=!0}),Uh=e}_g(3);var vg=0,yg=0,bg=null,xg=null;function Sg(){let e=new Map,t=new Map,n=new X;return Mh.forEach(r=>{let i=sg.get(r),a=i.count,o=new Float32Array(i.origPositions),s=new Float32Array(a*3);for(let e=0;e<a;e++)r.getColorAt(e,n),s[e*3]=n.r,s[e*3+1]=n.g,s[e*3+2]=n.b;e.set(r,o),t.set(r,s)}),{posMap:e,colMap:t}}function Cg(e){if(Wh&&yg===e||Uh===e&&!Wh)return;gg(e);let t=Sg();bg=t.posMap,xg=t.colMap,yg=e,vg=performance.now(),Wh=!0}var wg=new X;function Tg(){if(!Wh)return;let e=(performance.now()-vg)/1e3,t=Math.min(e/Gh,1);t=t<.5?4*t*t*t:1-(-2*t+2)**3/2;let n=lg[yg],r=lg[0];Mh.forEach(e=>{let i=sg.get(e),a=n.get(e),o=bg.get(e),s=xg.get(e),c=i.count,l=e.instanceMatrix.array,u=i.origPositions,d=i.offsets,f=a.positions,p=a.colors,m=r.get(e).positions;for(let n=0;n<c;n++){let r=n*3,i=o[r],a=o[r+1],c=o[r+2],h=(Math.sin(m[r]*.5+m[r+2]*.7)*.5+.5)*.3,g=Math.max(0,Math.min(1,(t-h)/(1-h))),_=i+(f[r]-i)*g,v=a+(f[r+1]-a)*g,y=c+(f[r+2]-c)*g;u[r]=_,u[r+1]=v,u[r+2]=y;let b=n*16;l[b+12]=_+d[r],l[b+13]=v+d[r+1],l[b+14]=y+d[r+2],wg.setRGB(s[r]+(p[r]-s[r])*g,s[r+1]+(p[r+1]-s[r+1])*g,s[r+2]+(p[r+2]-s[r+2])*g),e.setColorAt(n,wg)}e.instanceMatrix.needsUpdate=!0,e.instanceColor.needsUpdate=!0}),t>=1&&(Wh=!1,Uh=yg,bg=null,xg=null)}var Eg=new ac;Eg.name=`particleGroup`,gh.add(Eg);var Dg=120,Og=new sl,kg=new Float32Array(Dg*3),Ag=new Float32Array(Dg*3);for(let e=0;e<Dg;e++)kg[e*3]=(Math.random()-.5)*30,kg[e*3+1]=Math.random()*35-5,kg[e*3+2]=(Math.random()-.5)*24,Ag[e*3]=(Math.random()-.5)*.3,Ag[e*3+1]=(Math.random()-.5)*.1,Ag[e*3+2]=(Math.random()-.5)*.3;Og.setAttribute(`position`,new Kc(kg,3));var jg=new nu(Og,new Zl({color:16767392,opacity:.9,size:.11,transparent:!0,depthWrite:!1,blending:2,sizeAttenuation:!0}));jg.name=`dustMotes`,jg.frustumCulled=!1,Eg.add(jg);var Mg=40,Ng=new Hl(new lu(.5,.5),new vl({color:16777215,opacity:.8,transparent:!0,depthWrite:!1,side:2}),Mg);Ng.name=`fallingLeaves`,Ng.frustumCulled=!1,Eg.add(Ng);var Pg=[],Fg=new ic,Ig=new X,Lg=[[`#e63c2e`,`#d4452f`,`#f05a3a`,`#ff6b45`,`#f5a623`,`#ff8c42`],[`#1a4a2a`,`#224e30`,`#2a5a38`,`#1e4828`,`#164020`,`#2e6e3e`],[`#ffb7c5`,`#ff97b0`,`#ffc8d6`,`#fff0f5`,`#ffd0db`],[`#456f3a`,`#5a8845`,`#3a5e30`,`#9a5226`,`#b04030`,`#345532`]];function Rg(e){let t=Math.random()*Math.PI*2,n=Math.random()*6;Pg[e]={x:Math.cos(t)*n,y:18+Math.random()*8,z:Math.sin(t)*n,vx:(Math.random()-.5)*.8,vy:-(1.5+Math.random()*1.5),vz:(Math.random()-.5)*.8,rotX:Math.random()*Math.PI*2,rotY:Math.random()*Math.PI*2,rotZ:Math.random()*Math.PI*2,spinX:(Math.random()-.5)*2,spinY:(Math.random()-.5)*1.5,spinZ:(Math.random()-.5)*2,scale:.25+Math.random()*.45,wobblePhase:Math.random()*Math.PI*2,wobbleFreq:1.5+Math.random()*2,wobbleAmp:.3+Math.random()*.5,life:0,maxLife:4+Math.random()*6}}for(let e=0;e<Mg;e++)Rg(e),Pg[e].life=Math.random()*Pg[e].maxLife;function zg(e){let t=Math.min(e,.05),n=performance.now()*.001,r=Og.attributes.position.array;for(let e=0;e<Dg;e++)r[e*3]+=(Ag[e*3]+Math.sin(n*.5+e*.7)*.15)*t,r[e*3+1]+=(Ag[e*3+1]+Math.sin(n*.3+e*1.1)*.08)*t,r[e*3+2]+=(Ag[e*3+2]+Math.cos(n*.4+e*.9)*.15)*t,r[e*3]>18&&(r[e*3]=-18),r[e*3]<-18&&(r[e*3]=18),r[e*3+1]>35&&(r[e*3+1]=-5),r[e*3+1]<-5&&(r[e*3+1]=35),r[e*3+2]>14&&(r[e*3+2]=-14),r[e*3+2]<-14&&(r[e*3+2]=14);Og.attributes.position.needsUpdate=!0;let i=Lg[Uh]||Lg[0];if(Ng._lastVariation!==Uh){Ng._lastVariation=Uh;for(let e=0;e<Mg;e++)Ig.set(i[Math.floor(Math.random()*i.length)]),Ng.setColorAt(e,Ig);Ng.instanceColor.needsUpdate=!0}for(let e=0;e<Mg;e++){let r=Pg[e];r.life+=t,(r.life>=r.maxLife||r.y<-16)&&(Rg(e),Ig.set(i[Math.floor(Math.random()*i.length)]),Ng.setColorAt(e,Ig),Ng.instanceColor.needsUpdate=!0);let a=Math.sin(n*r.wobbleFreq+r.wobblePhase)*r.wobbleAmp;r.x+=(r.vx+a)*t,r.y+=r.vy*t,r.z+=(r.vz+Math.cos(n*r.wobbleFreq*.7+r.wobblePhase)*r.wobbleAmp*.6)*t,r.rotX+=r.spinX*t,r.rotY+=r.spinY*t,r.rotZ+=r.spinZ*t;let o=r.life/r.maxLife,s=o<.1?o/.1:o>.85?(1-o)/.15:1;Fg.position.set(r.x,r.y,r.z),Fg.rotation.set(r.rotX,r.rotY,r.rotZ),Fg.scale.setScalar(r.scale*s),Fg.updateMatrix(),Ng.setMatrixAt(e,Fg.matrix)}Ng.instanceMatrix.needsUpdate=!0}var Bg=new Sd,Vg=new q(9999,9999),Hg=10,Ug=18,Wg=2.5,Gg=0,Kg=.08,qg=new J(9999,9999,9999),Jg=!1,Yg=new J;cg.getCenter(Yg);var Xg=new Kl,Zg=new J;function Qg(e){let t=_h.getBoundingClientRect();Vg.x=(e.clientX-t.left)/t.width*2-1,Vg.y=-((e.clientY-t.top)/t.height)*2+1,Gg=performance.now()}function $g(){Vg.x=9999,Vg.y=9999}window.addEventListener(`mousemove`,Qg),window.addEventListener(`mouseleave`,$g);var e_=new J,t_=Math.max(cg.getSize(new J).length()*.55,15);function n_(e){let t=performance.now(),n=(t-Gg)/1e3>Kg;Bg.setFromCamera(Vg,bh),e_.copy(Bg.ray.direction).negate(),Xg.setFromNormalAndCoplanarPoint(e_,Yg);let r=Bg.ray.intersectPlane(Xg,Zg)!==null&&Zg.distanceTo(Yg)<t_;if(r){if(!Jg)qg.copy(Zg),Jg=!0;else if(!n){let t=1-Math.exp(-12*Math.min(e,.05));qg.lerp(Zg,t)}}else Jg=!1;let i=1-Math.exp(-(r?8:Wg)*Math.min(e,.05)),a=t;Mh.forEach(e=>{let{origPositions:t,offsets:n,randDirs:o,count:s}=sg.get(e),c=e.instanceMatrix.array,l=!1;for(let e=0;e<s;e++){let s=e*3,u=t[s],d=t[s+1],f=t[s+2],p=0,m=0,h=0;if(r){let e=u-qg.x,t=d-qg.y,n=f-qg.z,r=Math.sqrt(e*e+t*t+n*n);if(r<Hg&&r>.01){let i=1-r/Hg,c=i*i*i*Ug,l=1/r,g=u*1.3+d*.7+f*1.1,_=1+(Math.sin(a*.003+g)*.15+Math.sin(a*.0017+g*.6)*.1)*i,v=o[s],y=o[s+1],b=o[s+2],x=e*l*.6+v*.4,S=t*l*.6+y*.4,C=n*l*.6+b*.4,w=Math.sqrt(x*x+S*S+C*C)||1,T=c*_/w;p=x*T,m=S*T,h=C*T}}let g=n[s],_=n[s+1],v=n[s+2],y=g+(p-g)*i,b=_+(m-_)*i,x=v+(h-v)*i,S=y-g,C=b-_,w=x-v;if(S*S+C*C+w*w<=1e-8&&g*g+_*_+v*v<=1e-8)continue;n[s]=y,n[s+1]=b,n[s+2]=x;let T=e*16;c[T+12]=u+y,c[T+13]=d+b,c[T+14]=f+x,l=!0}l&&(e.instanceMatrix.needsUpdate=!0)})}var r_=new id(2760472,.45);r_.name=`ambientLight`,gh.add(r_);var i_=new rd(16764820,2.8);i_.name=`mainLight`,i_.position.set(6,14,5),i_.castShadow=!0,i_.shadow.mapSize.width=2048,i_.shadow.mapSize.height=2048,i_.shadow.camera.near=.5,i_.shadow.camera.far=40,i_.shadow.camera.left=-32,i_.shadow.camera.right=32,i_.shadow.camera.top=32,i_.shadow.camera.bottom=-32,i_.shadow.bias=1e-4,i_.shadow.normalBias=.05,i_.shadow.radius=5,i_.shadow.blurSamples=16,gh.add(i_);var a_=new rd(16772829,.6);a_.name=`softShadowLight`,a_.position.set(-3,8,6),a_.castShadow=!0,a_.shadow.mapSize.width=512,a_.shadow.mapSize.height=512,a_.shadow.camera.near=.5,a_.shadow.camera.far=30,a_.shadow.camera.left=-24,a_.shadow.camera.right=24,a_.shadow.camera.top=24,a_.shadow.camera.bottom=-24,a_.shadow.bias=1e-4,a_.shadow.normalBias=.05,a_.shadow.radius=3.75,a_.shadow.blurSamples=16,gh.add(a_);var o_=new rd(4878256,.6);o_.name=`fillLight`,o_.position.set(-5,8,-3),gh.add(o_);var s_=new ed(16751189,3,28,1.6);s_.name=`rimLight`,s_.position.set(-4,12,-5),gh.add(s_);var c_=new ed(16742970,2.6,24,1.6);c_.name=`accentLight`,c_.position.set(4,10,4),gh.add(c_);var l_=new rh(bh,Ch.domElement);l_.enableDamping=!0,l_.dampingFactor=.05,l_.minDistance=2,l_.maxDistance=500,l_.target.set(0,6,0);var u_=3,d_=8,f_=-1;function p_(){let e=bh.position.length();if(Math.abs(e-f_)<.15)return;f_=e;let t=Math.min(Math.max((e-u_)/(d_-u_),0),1),n=t*t*(3-2*t),r=Math.min(window.devicePixelRatio,1.5),i=Math.max(1,r*(.75+.25*n));Ch.setPixelRatio(i)}var m_=[3,0,1,2],h_=4e3,g_=5e3,__=!0,v_=performance.now(),y_=0;function b_(){y_=performance.now()+g_}var x_=[`pointerdown`,`wheel`,`touchstart`];x_.forEach(e=>{Ch.domElement.addEventListener(e,b_,{passive:!0})});function S_(e){if(!__||Wh){Wh&&(v_=e);return}if(e<y_){v_=e;return}e-v_<h_||Cg(m_[(m_.indexOf(Uh)+1)%m_.length])}var C_=performance.now();function w_(){let e=performance.now(),t=(e-C_)/1e3;C_=e,l_.update(),p_(),S_(e),Tg(),n_(t),zg(t),Ch.render(gh,bh)}Ch.setAnimationLoop(w_);function T_(){bh.aspect=vh()/yh(),bh.updateProjectionMatrix(),xh(),Ch.setSize(vh(),yh()),Ch.setPixelRatio(Math.min(window.devicePixelRatio,1.5)),f_=-1}window.addEventListener(`resize`,T_);var E_=!1;function D_(){E_||(E_=!0,Ch.setAnimationLoop(null),__=!1,window.removeEventListener(`mousemove`,Qg),window.removeEventListener(`mouseleave`,$g),window.removeEventListener(`resize`,T_),x_.forEach(e=>{Ch.domElement.removeEventListener(e,b_)}),l_.dispose(),O_(gh),Ch.renderLists?.dispose?.(),Ch.dispose(),Ch.forceContextLoss?.(),Ch.domElement.remove())}function O_(e){let t=new Set,n=new Set;e.traverse(e=>{if(e.geometry&&t.add(e.geometry),Array.isArray(e.material))for(let t of e.material)n.add(t);else e.material&&n.add(e.material)});for(let e of t)e.dispose?.();for(let e of n)k_(e)}function k_(e){for(let t of Object.values(e))t&&typeof t==`object`&&typeof t.dispose==`function`&&t.dispose();e.dispose?.()}var A_=`imgen_hf_token_v1`,j_=`imgen_model_id_v1`,M_=[{id:`prism-ml/bonsai-image-ternary-4B-mlx-2bit`,label:`Ternary`},{id:`prism-ml/bonsai-image-binary-4B-mlx-1bit`,label:`1-bit`}],N_=M_[0].id,P_=typeof window<`u`&&window.location.host.endsWith(`.hf.space`),F_=`webml-community/bonsai-image-webgpu`,I_=`imgen_db_v1`,L_=`images`,R_=12,z_=4,B_=256,V_=1024,H_=16,U_=[`A bonsai tree in a quiet ceramic studio, soft morning light, shallow depth of field`,`A tiny moss garden on a windowsill, rain on the glass, warm film photography`,`A red fox curled beneath paper lanterns, ink wash style, gentle shadows`,`A glass terrarium city at night, miniature streets, glowing storefronts`,`An icy Bonsai tree, in a rainy forest with snowy mountains in the background, photo realistic`,`A koi swimming through a flooded teahouse, lantern light, painterly mood`,`A small wooden cabin on a moss-covered cliff, drifting fog, dawn light`,`A vintage typewriter on a sunlit desk, dust in the air, faded Polaroid look`,`A field of fireflies above tall grass, deep blue twilight, dreamy bokeh`,`A snowy Japanese shrine path under torii gates, falling cherry blossoms, soft light`,`A weathered fishing boat in a quiet harbor, overcast sky, oil painting`,`A miniature library inside a hollow tree, warm candlelight, storybook illustration`,`A heron standing in shallow water at sunrise, mist on the lake, fine art photography`],W_=`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,G_=`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>`,K_=`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,q_=`<svg class="spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;function J_(){let e=Q.modelId||N_;return`Requires access to <a href="https://huggingface.co/${e}" target="_blank" rel="noopener noreferrer" class="model-id">${e}</a>`}var Q={modelId:N_,modelMenuOpen:!1,tokenInput:``,validating:!1,prompt:``,seed:``,width:512,height:512,steps:z_,lockedRatio:null,images:[],generating:!1,generationStatus:``,selectedIdx:null,visibleCount:R_,hydrated:!1,pipeline:null,pipelineLoading:!1,pipelineAbortController:null,cleanupStarted:!1,hardwareInfo:null},Y_=null,X_=null,Z_=null,Q_=new Set;function $_(e,t){let n=setTimeout(()=>{Q_.delete(n),e()},t);return Q_.add(n),n}var $=e=>document.getElementById(e),ev=()=>Math.floor(Math.random()*1e9),tv=e=>{let t=e;for(;t===e;)t=U_[Math.floor(Math.random()*U_.length)];return t},nv=e=>new Date(e).toLocaleString(void 0,{month:`short`,day:`numeric`,year:`numeric`,hour:`numeric`,minute:`2-digit`}),rv=e=>Number.isFinite(e)?e>=1e9?`${(e/1e9).toFixed(1)} GB`:e>=1e6?`${(e/1e6).toFixed(0)} MB`:e>=1e3?`${(e/1e3).toFixed(0)} KB`:`${e} B`:``;function iv(e){try{let t=new URL(e,window.location.href);return t.hostname===`huggingface.co`||t.hostname.endsWith(`.huggingface.co`)}catch{return!1}}async function av(e){let t=(e||``).trim();if(!t)return{valid:!1,error:`Token required.`};try{let e=await fetch(`https://huggingface.co/api/models/${Q.modelId}`,{headers:{Authorization:`Bearer ${t}`}});if(e.ok)return{valid:!0};if(e.status===401)return{valid:!1,error:`Invalid token.`};let n=null;try{n=await e.json()}catch{}let r=n?.error?String(n.error):``;return r.toLowerCase().includes(`repository not found`)||e.status===404?{valid:!1,error:`Token cannot access this model. Request access on the model page, then try again.`}:e.status===403?{valid:!1,error:`Access forbidden. Make sure your token has read permission.`}:{valid:!1,error:r||`Validation failed (HTTP ${e.status}).`}}catch(e){return{valid:!1,error:`Network error: ${e.message||e}`}}}var ov=null;function sv(e){ov||=window.fetch.bind(window);let t=ov;window.fetch=function(n,r){let i=``;if(typeof n==`string`?i=n:n instanceof URL?i=n.toString():n&&typeof n==`object`&&`url`in n&&(i=n.url),iv(i)){r||={};let t=r.headers||(n?.headers?.get?n.headers:{}),i=new Headers(t);i.has(`Authorization`)||i.set(`Authorization`,`Bearer ${e}`),r={...r,headers:i}}return t(n,r)}}var cv={text_encoder:`text encoder`,transformer:`transformer`,vae:`image decoder`};async function lv(e=null){if(Q.cleanupStarted)throw Error(`Demo is closing`);if(Q.pipeline)return Q.pipeline;if(Q.pipelineLoading){for(;Q.pipelineLoading;)await new Promise(e=>setTimeout(e,50));if(Q.pipeline)return Q.pipeline;throw Y_||Error(`Pipeline failed to load`)}Q.pipelineLoading=!0,Y_=null;let t=new AbortController;Q.pipelineAbortController=t;try{return Q.pipeline=await Bi.from_pretrained(Q.modelId,{onProgress:e||void 0,signal:t.signal}),Q.pipeline}catch(e){throw Y_=e,e}finally{Q.pipelineAbortController===t&&(Q.pipelineAbortController=null),Q.pipelineLoading=!1}}async function uv(){$(`gateSection`).hidden=!0,$(`hero`).hidden=!0,$(`loadingSection`).hidden=!1;let e=$(`loadingStatus`),t=$(`loadingBarFill`);e.textContent=`preparing…`,t.style.width=`0%`;let n=[`text_encoder`,`transformer`,`vae`],r={text_encoder:17e8,transformer:13e8,vae:95e6},i=Object.fromEntries(n.map(e=>[e,{loaded:0,total:r[e]}])),a=r=>{if(!r)return;if(r.phase===`init`){e.textContent=`loading configs…`;return}if(r.phase===`open`&&r.component){e.textContent=`opening ${cv[r.component]||r.component}…`;return}if(!r.component)return;let a=i[r.component];if(!a)return;Number.isFinite(r.total)&&r.total>0&&(a.total=r.total),Number.isFinite(r.loaded)&&(a.loaded=Math.min(a.total,Math.max(0,r.loaded)));let o=0,s=0;for(let e of n)o+=i[e].loaded,s+=i[e].total;t.style.width=`${Math.round(100*o/s)}%`;let c=cv[r.component]||r.component;e.textContent=Number.isFinite(r.total)&&r.total>0?`${r.fromCache?`loading`:`downloading`} ${c} (${rv(r.loaded)} / ${rv(r.total)})`:`loading ${c}…`};try{await lv(a),t.style.width=`100%`,e.textContent=`ready`}catch(t){throw e.textContent=`failed: ${t?.message||t}`,t}}async function dv(e,t){if(Q.cleanupStarted)throw Error(`Demo is closing`);let n=await lv(),r=performance.now(),i=await n.generate({prompt:e,height:t.height,width:t.width,guidance_scale:1,num_inference_steps:t.steps,seed:t.seed,callback_on_step_end:t.callback_on_step_end}),a=performance.now()-r,o=i.toBlob();return i.bytes=null,Ov({id:`${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,prompt:e,seed:t.seed,steps:t.steps,width:t.width,height:t.height,createdAt:Date.now(),modelId:Q.modelId,generationMs:a,blob:o})}async function fv(){let e=navigator.userAgent||``,t=navigator.platform||navigator.userAgentData?.platform||``,n=navigator.hardwareConcurrency||null,r=navigator.deviceMemory||null,i=null;try{if(navigator.gpu?.requestAdapter){let e=await navigator.gpu.requestAdapter(),t=e&&(e.info??await e.requestAdapterInfo?.());t&&(i=[t.vendor,t.architecture,t.device,t.description].filter(e=>e&&String(e).trim().length>0).join(` · `)||null)}}catch{}let a=/Edg\/(\S+)/.exec(e)?.[0].replace(`Edg`,`Edge`)??/Chrome\/(\S+)/.exec(e)?.[0]??/Firefox\/(\S+)/.exec(e)?.[0]??/Version\/(\S+).*Safari/.exec(e)?.[0].replace(`Version`,`Safari`)??`unknown`,o=/Windows NT [\d.]+/.exec(e)?.[0]??/Mac OS X [\d_]+/.exec(e)?.[0].replace(/_/g,`.`)??/Android \d+/.exec(e)?.[0]??/iPhone OS [\d_]+/.exec(e)?.[0].replace(/_/g,`.`)??/Linux/.exec(e)?.[0]??(t||`unknown`);return{gpu:i,browser:a,os:o,cores:n,mem:r}}function pv(e){return!Number.isFinite(e)||e<0?`—`:e<1e3?`${Math.round(e)} ms`:`${(e/1e3).toFixed(1)}s`}function mv(e,t){let n=Q.hardwareInfo||{},r=M_.find(t=>t.id===e.modelId),i=[`| Field | Value |`,`| --- | --- |`,...[[`Model`,r?`${r.label} (${e.modelId})`:e.modelId||`unknown`],[`Size`,`${e.width} × ${e.height}`],[`Steps`,String(e.steps)],[`Seed`,String(e.seed)],[`Gen time`,pv(e.generationMs)],[`GPU`,n.gpu||`—`],[`Browser`,n.browser||`—`],[`OS`,n.os||`—`]].map(([e,t])=>`| **${e}** | ${hv(t)} |`)].join(`
`);return[`![generated image](${t})`,``,`**Prompt:** ${hv(e.prompt)}`,``,i,``,`_Generated locally on WebGPU with [${F_}](https://huggingface.co/spaces/${F_})._`].join(`
`)}function hv(e){return String(e).replace(/\|/g,`\\|`).replace(/\n/g,` `)}async function gv(e){if(!e?.blob){alert(`Image data unavailable — cannot share.`);return}try{let t=await fetch(`https://huggingface.co/uploads`,{method:`POST`,body:e.blob});if(!t.ok)throw Error(`Upload failed: ${t.status} ${t.statusText}`);let n=(await t.text()).trim(),r=`Bonsai Image · ${_v(e.prompt)}`,i=mv(e,n),a=`https://huggingface.co/spaces/${F_}/discussions/new?${new URLSearchParams({title:r,description:i}).toString()}`;window.open(a,`_blank`,`noopener`)}catch(e){console.error(`share failed:`,e),alert(`Share failed: ${e?.message||e}`)}}function _v(e){let t=String(e||``).trim().replace(/\s+/g,` `);return t.length>80?t.slice(0,77)+`…`:t}var vv={get(e){try{return localStorage.getItem(e)}catch{return null}},set(e,t){try{localStorage.setItem(e,t)}catch{}}},yv=null;function bv(){return yv||(yv=new Promise((e,t)=>{let n=indexedDB.open(I_,1);n.onupgradeneeded=()=>{let e=n.result;e.objectStoreNames.contains(L_)||e.createObjectStore(L_,{keyPath:`id`})},n.onsuccess=()=>e(n.result),n.onerror=()=>t(n.error)}),yv)}var xv=e=>bv().then(t=>t.transaction(L_,e).objectStore(L_)),Sv=e=>new Promise((t,n)=>{e.onsuccess=()=>t(e.result),e.onerror=()=>n(e.error)}),Cv=async()=>Sv((await xv(`readonly`)).getAll()).then(e=>e||[]),wv=async e=>Sv((await xv(`readwrite`)).put(e)),Tv=async e=>Sv((await xv(`readwrite`)).delete(e)),Ev=async()=>Sv((await xv(`readwrite`)).clear());function Dv(e){return e.blob&&!e.url&&(e.url=URL.createObjectURL(e.blob),e.thumbUrl=e.url),e.url||``}function Ov(e){return Dv(e),e}function kv(e){e?.url&&(URL.revokeObjectURL(e.url),e.url=null,e.thumbUrl=null)}async function Av(){try{let e=await Cv();e.sort((e,t)=>t.createdAt-e.createdAt),Q.images=e}catch(e){console.error(`gallery load failed:`,e)}Q.hydrated=!0}async function jv(e){let{url:t,thumbUrl:n,...r}=e;try{await wv(r)}catch(e){console.error(`persist failed:`,e)}}var Mv=()=>vv.get(A_)||``,Nv=e=>vv.set(A_,e),Pv=()=>{let e=vv.get(j_);return M_.some(t=>t.id===e)?e:N_},Fv=e=>vv.set(j_,e),Iv=()=>M_.find(e=>e.id===Q.modelId)||M_[0],Lv=e=>{let t=Math.round(e/H_)*H_;return Math.min(V_,Math.max(B_,t))};function Rv(e,t){Q.width=e,Q.height=t,$(`widthSlider`).value=e,$(`heightSlider`).value=t,$(`widthValue`).textContent=e,$(`heightValue`).textContent=t,zv()}function zv(){$(`presets`).querySelectorAll(`.preset`).forEach(e=>{e.classList.toggle(`active`,e.dataset.ratio===Q.lockedRatio)})}function Bv(e,t,n){let r=Math.max(t,n);if(e>=1){let t=Lv(r);return[t,Lv(t/e)]}let i=Lv(r);return[Lv(i*e),i]}function Vv(){let e=$(`generateBtn`);e.disabled=!(Q.prompt.trim().length>0&&!Q.generating);let t=Q.generating?Q.generationStatus||`generating`:`generate`;e.innerHTML=Q.generating?`${q_}<span>${t}</span>`:`<span>${t}</span>`}function Hv(){let e=$(`continueBtn`);e.disabled=Q.tokenInput.trim().length===0||Q.validating,e.innerHTML=Q.validating?`${q_}<span>validating</span>`:`<span>continue</span>`}function Uv(){let e=Q.hydrated&&Q.images.length>0;$(`gallerySection`).hidden=!e,$(`galleryLink`).hidden=!e}function Wv(){let e=Q.images.length,t=e===1?`image`:`images`;$(`galleryLink`).textContent=`${e} ${t} ↓`,$(`imageCountTop`).textContent=`${e} ${t}`}function Gv(){let e=$(`localBadgeMeta`);if(!e)return;let t=Q.hardwareInfo?.gpu;if(!t){e.hidden=!0,e.textContent=``;return}let n=t.split(` · `).map(e=>e.trim()).filter(Boolean);e.textContent=n[n.length-1]||t,e.hidden=!1}function Kv(e,t){let n=document.createElement(`button`);n.className=`grid-item fade-up`,n.style.animationDelay=`${Math.min(t%R_*35,400)}ms`,n.dataset.id=e.id;let r=document.createElement(`div`);r.className=`shimmer`,n.appendChild(r);let i=document.createElement(`img`);i.className=`grid-img`,i.alt=e.prompt,i.loading=`lazy`,i.style.opacity=`0`,i.addEventListener(`load`,()=>{i.style.opacity=`1`,r.remove()}),i.addEventListener(`error`,()=>{r.remove();let e=document.createElement(`div`);e.className=`grid-fail`,e.textContent=`failed`,n.appendChild(e)}),i.src=Dv(e),n.appendChild(i);let a=document.createElement(`div`);a.className=`grid-overlay`;let o=document.createElement(`p`);if(o.className=`grid-prompt`,o.textContent=`"${e.prompt}"`,a.appendChild(o),n.appendChild(a),P_){let t=document.createElement(`div`);t.className=`grid-share`,t.setAttribute(`role`,`button`),t.setAttribute(`aria-label`,`Share`),t.setAttribute(`tabindex`,`0`),t.title=`Share to Hugging Face`,t.innerHTML=G_;let r=t=>{t.stopPropagation(),gv(e)};t.addEventListener(`click`,r),t.addEventListener(`keydown`,e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),r(e))}),n.appendChild(t)}return n.addEventListener(`click`,()=>{let t=Q.images.findIndex(t=>t.id===e.id);t>=0&&Zv(t)}),n}function qv(){let e=$(`grid`);e.innerHTML=``;let t=Q.images.slice(0,Q.visibleCount);for(let n=0;n<t.length;n++)e.appendChild(Kv(t[n],n))}function Jv(e){let t=$(`grid`);t.insertBefore(Kv(e,0),t.firstChild)}var Yv=new WeakMap,Xv=new Set;function Zv(e){e<0||e>=Q.images.length||(Q.selectedIdx=e,$(`modal`).hidden=!1,document.body.style.overflow=`hidden`,$v())}function Qv(){Q.selectedIdx=null,$(`modal`).hidden=!0,document.body.style.overflow=``;let e=$(`modalImg`);e&&(e.onload=null,e.removeAttribute(`src`),e.alt=``)}function $v(){let e=Q.images[Q.selectedIdx];if(!e)return Qv();let t=$(`modalImg`),n=$(`modalLoader`);t.style.opacity=`0`,n.style.display=`flex`,t.onload=()=>{t.style.opacity=`1`,n.style.display=`none`},t.src=Dv(e),t.alt=e.prompt,$(`metaPrompt`).textContent=`"${e.prompt}"`;let r=$(`copyIcon`),i=Yv.get(r);i&&(clearTimeout(i),Yv.delete(r)),r.innerHTML=W_,$(`copyPromptBtn`).classList.remove(`copied`);let a=$(`metaParams`);a.innerHTML=``;let o=[[`seed`,e.seed],[`size`,`${e.width} × ${e.height}`],[`steps`,e.steps]];Number.isFinite(e.generationMs)&&o.push([`gen time`,pv(e.generationMs)]),o.push([`created`,nv(e.createdAt)]);for(let[e,t]of o){let n=document.createElement(`div`);n.className=`meta-row`;let r=document.createElement(`dt`);r.textContent=e;let i=document.createElement(`dd`);i.textContent=t,n.appendChild(r),n.appendChild(i),a.appendChild(n)}let s=$(`modalShare`);s&&(s.hidden=!P_),$(`modalPrev`).hidden=Q.selectedIdx===0,$(`modalNext`).hidden=Q.selectedIdx>=Q.images.length-1}var ey=()=>{Q.selectedIdx>0&&(Q.selectedIdx--,$v())},ty=()=>{Q.selectedIdx!==null&&Q.selectedIdx<Q.images.length-1&&(Q.selectedIdx++,$v())};async function ny(e){try{return await navigator.clipboard.writeText(e),!0}catch{}try{let t=document.createElement(`textarea`);t.value=e,t.style.position=`fixed`,t.style.left=`-9999px`,document.body.appendChild(t),t.select();let n=document.execCommand(`copy`);return document.body.removeChild(t),n}catch{return!1}}async function ry(e,t,n=null){if(!await ny(e))return!1;t.innerHTML=K_,n?.classList.add(`copied`);let r=Yv.get(t);r&&(clearTimeout(r),Xv.delete(r));let i=setTimeout(()=>{t.innerHTML=W_,n?.classList.remove(`copied`),Yv.delete(t),Xv.delete(i)},1500);return Yv.set(t,i),Xv.add(i),!0}async function iy(){if(Q.selectedIdx===null)return;let e=Q.images[Q.selectedIdx];e&&await ry(e.prompt,$(`copyIcon`),$(`copyPromptBtn`))}async function ay(){let e=Q.prompt.trim();if(!e||Q.generating)return;Q.generating=!0,Q.generationStatus=`starting…`,Vv();let t=performance.now(),n=()=>((performance.now()-t)/1e3).toFixed(1)+`s`,r=Q.generationStatus,i=setInterval(()=>{Q.generationStatus=`${r} · ${n()}`,Vv()},250);try{let t=Q.seed===``?ev():Number(Q.seed),i=Q.steps,a=await dv(e,{seed:t,width:Q.width,height:Q.height,steps:i,callback_on_step_end:(e,t)=>{r=`step ${t+1}/${i}`,Q.generationStatus=`${r} · ${n()}`,Vv()}});Q.images=[a,...Q.images],Q.visibleCount=Math.min(Q.visibleCount+1,Q.images.length),await jv(a),Uv(),Wv(),Jv(a),$_(()=>{$(`gallerySection`).scrollIntoView({behavior:`smooth`,block:`start`})},80)}catch(e){console.error(`generation failed:`,e),alert(`Generation failed: ${e?.message||e}`)}finally{clearInterval(i),Q.generating=!1,Q.generationStatus=``,Vv()}}async function oy(e){let t=Q.images.findIndex(t=>t.id===e);if(t<0)return;let[n]=Q.images.splice(t,1);kv(n);try{await Tv(e)}catch(e){console.error(`delete failed:`,e)}$(`grid`).querySelector(`[data-id="${e}"]`)?.remove(),Wv(),Uv(),Q.selectedIdx!==null&&(Q.images.length===0?Qv():(Q.selectedIdx>=Q.images.length&&(Q.selectedIdx=Q.images.length-1),$v()))}async function sy(){if(confirm(`Delete all generations?`)){Qv();for(let e of Q.images)kv(e);Q.images=[],Q.selectedIdx=null,Q.visibleCount=R_;try{await Ev()}catch(e){console.error(`clear failed:`,e)}$(`grid`).innerHTML=``,Wv(),Uv()}}function cy(){for(let e of Q_)clearTimeout(e);Q_.clear();for(let e of Xv)clearTimeout(e);Xv.clear()}async function ly(){return X_||(Q.cleanupStarted=!0,X_=(async()=>{Q.pipelineAbortController?.abort(),Q.pipelineAbortController=null,cy(),Z_?.disconnect(),Z_=null;let e=$(`modalImg`);e&&(e.onload=null,e.removeAttribute(`src`),e.alt=``),document.querySelectorAll(`#grid img`).forEach(e=>{e.onload=null,e.onerror=null,e.removeAttribute(`src`)});for(let e of Q.images)kv(e);let t=Q.pipeline;Q.pipeline=null,Q.pipelineLoading=!1;try{await t?.destroy?.()}catch(e){console.warn(`pipeline cleanup failed:`,e)}})(),X_)}function uy(){let e=$(`tokenHelp`);e.classList.contains(`error`)&&(e.classList.remove(`error`),e.innerHTML=J_(),$(`tokenInputWrap`).classList.remove(`error`))}function dy(e){let t=$(`tokenHelp`);t.classList.add(`error`),t.textContent=e,$(`tokenInputWrap`).classList.add(`error`)}async function fy(){await ry($(`flagUrl`).textContent,$(`flagCopyIcon`))}async function py(){let e=Q.tokenInput.trim();if(!e||Q.validating)return;Q.validating=!0,Hv(),uy();let t=await av(e);t.valid?(sv(e),Nv(e),Q.validating=!1,await my()):(Q.validating=!1,dy(t.error),Hv())}async function my(){let e=Q.hydrated?Promise.resolve():Av().then(()=>{qv(),Wv(),Uv()});try{await uv()}catch(e){console.error(`pipeline preload failed:`,e);return}await e,$(`loadingSection`).hidden=!0,$(`hero`).hidden=!1,$_(()=>$(`prompt`).focus(),50)}function hy(){let e=Iv(),t=$(`ctaModelLabel`);t&&(t.textContent=e.label),document.querySelectorAll(`#modelMenu .model-menu-item`).forEach(e=>{e.classList.toggle(`selected`,e.dataset.modelId===Q.modelId),e.setAttribute(`aria-checked`,e.dataset.modelId===Q.modelId)});let n=$(`tokenHelp`);n&&!n.classList.contains(`error`)&&(n.innerHTML=J_())}function gy(e){Q.modelMenuOpen=e;let t=$(`modelMenu`),n=$(`modelMenuToggle`);!t||!n||(t.hidden=!e,n.setAttribute(`aria-expanded`,e?`true`:`false`))}function _y(e){if(!M_.some(t=>t.id===e)||e===Q.modelId){gy(!1);return}Q.modelId=e,Fv(e),hy(),gy(!1)}function vy(){$(`tryDemoBtn`).addEventListener(`click`,xy),$(`modelMenuToggle`).addEventListener(`click`,e=>{e.stopPropagation(),gy(!Q.modelMenuOpen)}),$(`modelMenu`).addEventListener(`click`,e=>{let t=e.target.closest(`.model-menu-item`);t&&_y(t.dataset.modelId)}),document.addEventListener(`click`,e=>{Q.modelMenuOpen&&(e.target.closest(`#ctaGroup`)||gy(!1))}),document.addEventListener(`keydown`,e=>{e.key===`Escape`&&Q.modelMenuOpen&&gy(!1)}),$(`tokenInput`).addEventListener(`input`,e=>{Q.tokenInput=e.target.value,Hv(),uy()}),$(`tokenInput`).addEventListener(`keydown`,e=>{e.key===`Enter`&&(e.preventDefault(),py())}),$(`tokenToggleBtn`).addEventListener(`click`,()=>{let e=$(`tokenInput`),t=$(`tokenToggleBtn`),n=e.type===`password`;e.type=n?`text`:`password`,t.textContent=n?`hide`:`show`}),$(`continueBtn`).addEventListener(`click`,py),$(`flagCopyBtn`).addEventListener(`click`,fy),$(`prompt`).addEventListener(`input`,e=>{Q.prompt=e.target.value,Vv()}),$(`prompt`).addEventListener(`keydown`,e=>{e.key===`Enter`&&!e.shiftKey&&(e.preventDefault(),ay())}),$(`exampleBtn`).addEventListener(`click`,()=>{let e=tv(Q.prompt);Q.prompt=e,$(`prompt`).value=e,Vv()}),$(`presets`).querySelectorAll(`.preset`).forEach(e=>{e.addEventListener(`click`,()=>{let t=e.dataset.ratio;if(Q.lockedRatio===t){Q.lockedRatio=null,zv();return}let n=parseInt(e.dataset.rw,10),r=parseInt(e.dataset.rh,10);Q.lockedRatio=t;let[i,a]=Bv(n/r,Q.width,Q.height);Rv(i,a)})}),$(`widthSlider`).addEventListener(`input`,e=>{let t=parseInt(e.target.value,10);if(Q.width=t,$(`widthValue`).textContent=t,Q.lockedRatio){let e=$(`presets`).querySelector(`.preset[data-ratio="${Q.lockedRatio}"]`),n=parseInt(e.dataset.rw,10),r=Lv(t*parseInt(e.dataset.rh,10)/n);Q.height=r,$(`heightSlider`).value=r,$(`heightValue`).textContent=r}}),$(`heightSlider`).addEventListener(`input`,e=>{let t=parseInt(e.target.value,10);if(Q.height=t,$(`heightValue`).textContent=t,Q.lockedRatio){let e=$(`presets`).querySelector(`.preset[data-ratio="${Q.lockedRatio}"]`),n=parseInt(e.dataset.rw,10),r=parseInt(e.dataset.rh,10),i=Lv(t*n/r);Q.width=i,$(`widthSlider`).value=i,$(`widthValue`).textContent=i}}),$(`stepsSlider`).addEventListener(`input`,e=>{let t=parseInt(e.target.value,10);Q.steps=t,$(`stepsValue`).textContent=t}),$(`seedInput`).addEventListener(`input`,e=>{let t=e.target.value;t===``||/^\d{1,12}$/.test(t)?Q.seed=t:e.target.value=Q.seed}),$(`randomSeedBtn`).addEventListener(`click`,()=>{let e=String(ev());Q.seed=e,$(`seedInput`).value=e}),$(`generateBtn`).addEventListener(`click`,ay),$(`galleryLink`).addEventListener(`click`,()=>{$(`gallerySection`).scrollIntoView({behavior:`smooth`})}),$(`newBtn`).addEventListener(`click`,()=>{$(`hero`).scrollIntoView({behavior:`smooth`})}),$(`clearAllBtn`).addEventListener(`click`,sy),$(`modal`).addEventListener(`click`,e=>{e.target===$(`modal`)&&Qv()}),$(`modalClose`).addEventListener(`click`,Qv),$(`modalPrev`).addEventListener(`click`,ey),$(`modalNext`).addEventListener(`click`,ty),$(`modalDelete`).addEventListener(`click`,()=>{if(Q.selectedIdx===null)return;let e=Q.images[Q.selectedIdx];e&&oy(e.id)});let e=$(`modalShare`);e&&e.addEventListener(`click`,async()=>{if(Q.selectedIdx===null)return;let t=Q.images[Q.selectedIdx];if(!t)return;let n=e.innerHTML;e.disabled=!0,e.innerHTML=`${q_}<span>sharing…</span>`;try{await gv(t)}finally{e.disabled=!1,e.innerHTML=n}}),$(`copyPromptBtn`).addEventListener(`click`,iy),document.addEventListener(`keydown`,e=>{Q.selectedIdx!==null&&(e.key===`Escape`?Qv():e.key===`ArrowLeft`?ey():e.key===`ArrowRight`&&ty())}),window.addEventListener(`pagehide`,e=>{e.persisted||ly()}),window.addEventListener(`beforeunload`,()=>{ly()})}function yy(){Z_?.disconnect(),Z_=new IntersectionObserver(e=>{if(e[0].isIntersecting&&Q.visibleCount<Q.images.length){let e=Q.visibleCount;Q.visibleCount=Math.min(Q.visibleCount+R_,Q.images.length);let t=$(`grid`);for(let n=e;n<Q.visibleCount;n++)t.appendChild(Kv(Q.images[n],n))}},{rootMargin:`400px`}),Z_.observe($(`loadMoreSentinel`))}async function by(){if(`fonts`in document)try{await Promise.race([Promise.all([document.fonts.load(`italic 1em "Instrument Serif"`),document.fonts.load(`1em "Geist"`),document.fonts.load(`1em "Geist Mono"`)]),new Promise(e=>setTimeout(e,2e3))])}catch{}}function xy(){let e=$(`landingSection`);if(!e||e.classList.contains(`leaving`))return;e.classList.add(`leaving`);let t=!1,n=()=>{t||(t=!0,e.hidden=!0,D_(),my())},r=t=>{t.target===e&&(e.removeEventListener(`transitionend`,r),n())};e.addEventListener(`transitionend`,r),$_(n,700)}async function Sy(){Q.modelId=Pv(),vy(),hy(),fv().then(e=>{Q.hardwareInfo=e,Gv()}).catch(()=>{}),yy(),$(`copyIcon`).innerHTML=W_,$(`flagCopyIcon`).innerHTML=W_,zv();let e=Mv();e&&($(`tokenInput`).value=e,Q.tokenInput=e),await by(),document.body.classList.add(`loaded`)}export { Bi as BonsaiImagePipeline, ly as cleanupBonsaiDemo, D_ as destroyBonsaiDemoScene };
