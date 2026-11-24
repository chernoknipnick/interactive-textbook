// Local test fixture only. Never copied into the published build.
(() => {
  const state=window.__accountTest={calls:[],finished:[],directoryPages:[],feedbackStatus:'new',failStats:false,delay:0,cb:null,holds:{},errors:{},user:{id:'admin-demo',email:'admin@example.test',user_metadata:{full_name:'Администратор'}}};
  for (const name of window.__holdAccountReads || []) state.holds[name] = true;
  async function read(name, data) {
    state.calls.push(name);
    while (state.holds[name]) await new Promise(resolve => setTimeout(resolve, 10));
    state.finished.push(name);
    return state.errors[name] ? {data:null,error:{message:'network'}} : response(data());
  }
  state.emit=(event,user=state.user)=>{state.user=user;state.cb?.(event,user?{user,access_token:'fixture-token',expires_at:Date.now()/1000+3600}:null)};
  const response=data=>({data,error:null});
  const stats={accounts:31,confirmed:26,unconfirmed:5,new_today:3,new_7_days:18,groups:4,group_members:22,generated_at:new Date().toISOString(),daily:Array.from({length:14},(_,i)=>({date:new Date(Date.UTC(2026,10,i+3)).toISOString().slice(0,10),count:i%5}))};
  state.stats=stats;
  const client={
    auth:{
      onAuthStateChange(cb){state.cb=cb;setTimeout(()=>state.emit('INITIAL_SESSION'),0);return {data:{subscription:{unsubscribe(){}}}}},
      getUser(token){state.lastAuthToken=token;return read('getUser',()=>({user:state.user}))},
      async signOut(){state.emit('SIGNED_OUT',null);return response(null)},
      async signInWithPassword(){state.emit('SIGNED_IN',{id:'admin-demo',email:'admin@example.test',user_metadata:{full_name:'Администратор'}});return response({})},
      async updateUser(){state.emit('USER_UPDATED');return response({user:state.user})}
    },
    from(table) {
      let update;
      const request = {
        select(){return request}, eq(){return request}, order(){return request}, limit(){return request},
        maybeSingle(){return request}, update(values){update=values;return request}, single(){return request},
        then(resolve,reject) {
          if (table==='textbook_feedback' && update) {
            return read('save_feedback',()=>{state.feedbackStatus=update.status;return {id:'demo'}}).then(resolve,reject);
          }
          return read(table,()=>{
            if (table==='textbook_profiles') return {full_name:state.user?.user_metadata.full_name};
            if (table==='textbook_teachers') return [{user_id:state.user?.id}];
            if (table==='textbook_administrators') return state.user?.id==='admin-demo'?[{user_id:state.user.id}]:[];
            if (table==='textbook_feedback') return [{id:'demo',category:'idea',message:'Добавьте ещё примеры с массивами.',sender_name:'Учебная группа',status:state.feedbackStatus,created_at:new Date().toISOString()}];
            return [];
          }).then(resolve,reject);
        }
      };
      return request;
    },
    async rpc(name,args){if(name==='textbook_create_group')return read(name,()=>null);state.calls.push(name);if(name==='textbook_admin_statistics')return state.failStats?{data:null,error:{message:'offline'}}:response(stats);
      if(name==='textbook_admin_users'){
        state.directoryPages.push(args.p_page);
        while (state.holds[name]) await new Promise(resolve => setTimeout(resolve, 10));
        if(state.delay)await new Promise(r=>setTimeout(r,state.delay));
        const rows=Array.from({length:31},(_,i)=>({id:String(i),full_name:i===0?'<img src=x onerror=alert(1)>':'Студент '+(i+1),email:'student'+i+'@example.test',created_at:new Date().toISOString(),confirmed:i%3!==0,role:'student'})).filter(u=>(u.full_name+' '+u.email).toLowerCase().includes(args.p_query.toLowerCase()));
        return response({total:rows.length,page:args.p_page,page_size:25,users:rows.slice((args.p_page-1)*25,args.p_page*25)})
      }
      return response(null)}
  };
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)state.emit('SIGNED_IN')});
  window.addEventListener('focus',()=>state.emit('SIGNED_IN'));
  window.supabase={createClient:()=>client};
})();
