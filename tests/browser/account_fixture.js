// Local test fixture only. Never copied into the published build.
(() => {
  const state=window.__accountTest={calls:[],failStats:false,delay:0,cb:null,user:{id:'admin-demo',email:'admin@example.test',user_metadata:{full_name:'Администратор'}}};
  state.emit=(event,user=state.user)=>{state.user=user;state.cb?.(event,user?{user}:null)};
  const response=data=>({data,error:null});
  const stats={accounts:31,confirmed:26,unconfirmed:5,new_today:3,new_7_days:18,groups:4,group_members:22,generated_at:new Date().toISOString(),daily:Array.from({length:14},(_,i)=>({date:new Date(Date.UTC(2026,10,i+3)).toISOString().slice(0,10),count:i%5}))};
  state.stats=stats;
  const client={
    auth:{
      onAuthStateChange(cb){state.cb=cb;setTimeout(()=>state.emit('INITIAL_SESSION'),0);return {data:{subscription:{unsubscribe(){}}}}},
      async getUser(){state.calls.push('getUser');return response({user:state.user})},
      async signOut(){state.emit('SIGNED_OUT',null);return response(null)},
      async signInWithPassword(){state.emit('SIGNED_IN',{id:'admin-demo',email:'admin@example.test',user_metadata:{full_name:'Администратор'}});return response({})},
      async updateUser(){state.emit('USER_UPDATED');return response({user:state.user})}
    },
    from(table){const request={select(){return request},eq(){return request},order(){return request},limit(){return request},maybeSingle(){return request},update(){return request},single(){return request},then(resolve){state.calls.push(table);const data=table==='textbook_profiles'?{full_name:state.user.user_metadata.full_name}:table==='textbook_teachers'?[{user_id:state.user.id}]:table==='textbook_administrators'?(state.user.id==='admin-demo'?[{user_id:state.user.id}]:[]):table==='textbook_feedback'?[{id:'demo',category:'idea',message:'Добавьте ещё примеры с массивами.',sender_name:'Учебная группа',status:'new',created_at:new Date().toISOString()}]:[];return Promise.resolve(response(data)).then(resolve)}};return request},
    async rpc(name,args){state.calls.push(name);if(name==='textbook_admin_statistics')return state.failStats?{data:null,error:{message:'offline'}}:response(stats);
      if(name==='textbook_admin_users'){if(state.delay)await new Promise(r=>setTimeout(r,state.delay));const rows=Array.from({length:31},(_,i)=>({id:String(i),full_name:i===0?'<img src=x onerror=alert(1)>':'Студент '+(i+1),email:'student'+i+'@example.test',created_at:new Date().toISOString(),confirmed:i%3!==0,role:'student'})).filter(u=>(u.full_name+' '+u.email).toLowerCase().includes(args.p_query.toLowerCase()));return response({total:rows.length,page:args.p_page,page_size:25,users:rows.slice((args.p_page-1)*25,args.p_page*25)})}
      return response(null)}
  };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)state.emit('SIGNED_IN')});
  window.addEventListener('focus',()=>state.emit('SIGNED_IN'));
  window.supabase={createClient:()=>client};
})();
