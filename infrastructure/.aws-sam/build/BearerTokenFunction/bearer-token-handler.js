"use strict";var s=Object.defineProperty;var i=Object.getOwnPropertyDescriptor;var p=Object.getOwnPropertyNames;var m=Object.prototype.hasOwnProperty;var b=(n,e)=>{for(var o in e)s(n,o,{get:e[o],enumerable:!0})},u=(n,e,o,a)=>{if(e&&typeof e=="object"||typeof e=="function")for(let t of p(e))!m.call(n,t)&&t!==o&&s(n,t,{get:()=>e[t],enumerable:!(a=i(e,t))||a.enumerable});return n};var y=n=>u(s({},"__esModule",{value:!0}),n);var w={};b(w,{BearerTokenHandler:()=>c,lambdaHandler:()=>h});module.exports=y(w);var c=class{async handler(e,o){let a=e.oAuthURL.value,t={client_secret:e.totp+e.clientSecret.value,client_id:e.clientId.value,grant_type:"client_credentials"},l=Object.keys(t).map(r=>encodeURIComponent(r)+"="+encodeURIComponent(t[r])).join("&");return{token:(await(await fetch(a,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:l})).json()).access_token}}},d=new c,h=d.handler.bind(d);0&&(module.exports={BearerTokenHandler,lambdaHandler});
//# sourceMappingURL=bearer-token-handler.js.map
