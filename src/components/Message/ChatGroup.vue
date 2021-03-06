<template>
 <!--  群聊 -->
 <div class="wrapper">
    <div class="header">
      <div class="item left" @click="back"></div>
      <div class="item center">
      	<span class="name">{{dataList.groupName}}</span>
      </div>
      <div class="item right">
      	<img src="/static/icon/4/skin_header_icon_group_selected.png" class="person">
      </div>
    </div>
    
    <VScroll :isScrollToBottom='isScrollToBottom' :data="dataList.message">
      <div class="chat">
          <ul>
              <li v-for="item in dataList.message" :class="{
                  'time':item.type=='time',
                  'me':item.type=='message'&&item.content.from=='me',
                  'other':item.type=='message'&&item.content.from=='other'}">
                  <template v-if="item.type=='message'">
                      <img :src="item.content.face"
                      @click="$router.push(`/profile/${item.content.user_id}`)">
                      <p class="name">{{item.content.name}} :</p>
                  	  <p class="message">{{item.content.message}}</p>
      				    </template>
      				    <template v-else>
      				    	{{item.content}} 
      				    </template>
              </li>
          </ul>
      </div>
    </VScroll>

    <div class="footer">
    	 <div class="writeMessage">
    	 	 <textarea v-model="writeMessage"></textarea>
    	 	 <button class="btn" :class="{'enable':writeMessage!=''}"
            @click="sendMessage">发送</button>
    	 </div>
    	 <div class="other">
      	 	<div class="item" v-for="item in iconUrl">
      	 		<img :src="item">
      	 	</div>
    	 </div>
    </div>
 </div>
</template>

<script>
import VScroll from '@/base/Scroll/Scroll'
import * as api from '@/api/chatGroup'
import {mapGetters} from 'vuex'
import {parseChatTime} from '@/common/js/parse-time'

export default {
  name: 'ChatGroup',
  data(){
     return {
       isScrollToBottom:true,
       writeMessage:'',  //要发送的消息
       dataList:{
          groupId:'',  //群id
          groupName:'正在加载中...',  //群名称
          groupAvator:'',  //群头像
          groupMember:[],  //其它群成员的id（方便socket給指定群成员发送消息）
          nick_name:'',  //自己的群昵称
          message:[]  //拉取到的消息
       },
       iconName:['ptt','image','ptv','camera','hongbao','flash','emotion','plus']
    }
  },
  computed:{
    ...mapGetters([
      'userId',
      'userInfo'
    ]),
    iconUrl(){
      return this.iconName.map(item=>`/static/icon/4/skin_aio_panel_${item}_nor.png`)
    }
  },
  mounted(){
    this.dataList.groupId=this.$route.params.group_id  //群id
    this.getMessage(this.userId,this.dataList.groupId)  //拉取群聊天消息
    this.updateBySocket()  //通过socket来更新消息
  },
  components:{
    VScroll
  },
  methods:{
    //获取群消息
    async getMessage(userId,groupId){
      const {data} = await api.get_message(userId,groupId)
      const {info,message,groupMember} = data
      this.dataList.groupId=info.id  // 群id
      this.dataList.groupAvator=info.group_avator   // 群头像
      this.dataList.groupName=info.group_name   // 群id
      this.dataList.nick_name=info.nick_name  // 自己的群昵称
      this.dataList.groupMember=groupMember  //其它群成员的id

      //取消息
      if(message.length==0) return
      message.sort((prev,current)=>{  //按时间升序排列
        return prev.time>current.time
      })

      //添加第一条时间消息，不需要经过判断
      this.isAddTimeMessage(0,message[0].time)
      //添加消息内容
      for(let [index,value] of message.entries()){
          //需要通过判断才能确定是否要添加时间消息
          index>0 && this.isAddTimeMessage(1, value.time, message[index-1].time)
          let content={
              type:'message',
              content:{
                user_id:value.from_user,  // 发送方的id
                from:value.from_user==this.userId?'me':'other',
                face:value.face, // 发送方的头像
                name:value.nick_name,  // 发送方的群昵称
                message:value.message.substr(value.message.indexOf(':')+1),//发送方的消息
                time:value.time // 发送方的发送时间
              } 
          }
          this.dataList.message.push(content)
      }
    },
    //发送消息
    async sendMessage(){
      if(this.writeMessage=='') return

      this.sendBySocket()  //先通过socket发送消息
    
      //持久化到服务器
      let data={
        userId:this.userId, //发送方的id
        groupId:this.dataList.groupId, //群id
        message:this.writeMessage,  //消息内容
        nickName:this.dataList.nick_name, //用户的群昵称
        time:Date.parse(new Date())/1000  //时间
      }
      const {code} = await api.send_message(data)
      if(code==1){  //如果发送成功了
        data={
          type:'message',
          content:{
            user_id:this.userId,  //用户的id
            from:'me',
            name:this.dataList.nick_name,  //用户的群昵称
            face:this.userInfo.face,   //用户的头像
            message:this.writeMessage,  //发送的消息
            time:Date.parse(new Date())/1000 //发送时间
          } 
        }
        //本地追加自己发送的消息
        this.addMessageLocal(data)
      }
    },
    // 本地追加消息
    addMessageLocal(data){
      const message=this.dataList.message //获取本地已经存在的消息
      if(message.length==0){//如果本地原来没有消息，则直接添加时间消息，不需要经过比较判断
        this.isAddTimeMessage(0, data.content.time)
      }else{  //否则需要经过比较判断才能确定是否要添加时间消息
        const latestMessage = message[message.length-1] //本地最新的一条消息
        const latestTime=latestMessage.content.time  //该消息的时间
        this.isAddTimeMessage(1, data.content.time, latestTime)
      }
      this.dataList.message.push(data)  
    },
    //是否要添加时间消息
    isAddTimeMessage(flag,currentTime,prevTime=''){
      if(flag){   //当flag为真时,需要比较判断，才能确定是否要添加时间
        const seprator=30*60   //时间间隔基准,半个小时
        if(currentTime-prevTime>seprator){//当下一条消息和这条消息的时间间隔大于30分钟,才添加时间
          this.dataList.message.push({
            type:'time',
            content:parseChatTime(currentTime)
          })
        } 
      }else{  //当flag为假时,是必须要添加时间消息的
        this.dataList.message.push({
          type:'time',
          content:parseChatTime(currentTime)
        })
      }
    },
    // 返回时更新状态
    back(){
      api.update_enter_chat(this.userId,this.dataList.groupId) 
      this.$router.back()
    },
    // socket更新消息
    updateBySocket(){
      socket.removeAllListeners()  //一定要先移除原来的事件，否则会有重复的监听器
      
      socket.on('receiveGroupMessage',(data)=>{
          //如果不包含自己，则直接丢弃这个socket消息
          if(!data.group_member.includes(this.userId))  return

          //本地追加别人通过socket发来的消息
          this.addMessageLocal({
              type:'message',
              content:{
                user_id:data.from_user_id,  //发送方的id
                from:'other',  //是别人发送的
                name:data.from_user_nick_name, //发送方的群昵称
                face:data.from_user_face, // 发送方的头像
                message:data.message, //发送的消息
                time:data.time  //发送方的发送时间
              } 
          })
      })
    },
    // socket发送消息
    sendBySocket(){
      socket.emit('sendGroupMessage',{
          group_id:this.dataList.groupId,  //群id
          group_name:this.dataList.groupName, //群名称
          group_avator:this.dataList.groupAvator,  //群头像
          group_member:this.dataList.groupMember, //所有群成员的id,方便socket判断
          from_user_id:this.userId,   //自己的id
          from_user_nick_name:this.dataList.nick_name,  //自己的群昵称
          from_user_face:this.userInfo.face,   //自己的头像
          message:this.writeMessage,  //消息内容
          time:Date.parse(new Date())/1000  //时间
      })
    }
  }
}
</script>
<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="scss" type="text/css">
#wrapper{
   background:#EFEFEF !important;
   bottom:70px !important
}
.header{
	  display:flex;
    padding:0 20px;
    height:50px;
    line-height:50px;
    background: #1E90FF;
    color: white;
    font-size:18px;
    position:absolute;
    top:0;
    width:100%;
    z-index:3;
    .item{
    	flex:1;
        &.left{
            background:url(/static/icon/4/flc.png) no-repeat left center;
            margin-left:-10px;
            padding-left:20px;
            background-size:26px 26px;
            cursor:pointer;
        }
        &.center{
            text-align:center;
            span{
              display:block;
              letter-spacing:2px;
              line-height:26px;
              font-size:16px;
              overflow:hidden;
              margin:0 auto;
              width:240px;
              text-overflow:ellipsis; /*当文本溢出时显示省略标记(...)*/
              white-space:nowrap; /*不换行*/
            }
        }
        &.right{
            text-align:right;
            cursor:pointer;
            position:relative;
            left:20px;
            img{
               transform:scale(0.5)
            }
        }
    }
}
.chat {
	cursor:pointer;
    ul{
	    width:100%;   
	    li{  
	      padding:6px 10px;
	      img{
	      	border-radius:50%;
	      	width:46px;
	      	height:46px;
	      }
	      p.message{
	      	min-height:40px;
	      	line-height:30px;
	        max-width:56%;
	      	display:inline-block;
	      	border-radius:10px;
	      	padding:6px 10px;
	      	margin-top:10px;
	      	text-align:left;
          word-break: break-all; 
	      }
	      p.name{
	      	color:#666;
	      	font-size:14px;
	      	position:relative;
	      }
	    }
	    li.time{
	       height:40px;
	       line-height:40px;
	       font-size:14px;
	       color:#666;
	       text-align:center;
	    }
	    li.me{
	    	text-align:right;
	    	overflow:hidden;
	    	img{
	    		float:right;
	    	}
	    	p.message{
	    		margin-right:10px;
	    		background:#1E90FF;
	    		color:#fff;
	    	}
	    	p.name{
	    	    right:14px;
	    	}
	    }
	    li.other{
	    	text-align:left;
	    	overflow:hidden;
	    	img{
	    		float:left;
	    	}
	    	p.message{
	    		margin-left:10px;
	    		background:#fff;
	    		color:#000;
	    	}
	    	p.name{
	    	    left:14px;
	    	}
	    }
    }
}
.footer{
	width:100%;
	height:70px;
	position:absolute;
	bottom:0;
	background:#eee;
	.writeMessage{
		height:32px;
		display:flex;
    textarea{
      width:80%;
      margin:0 6px;
      padding-left:6px;
      border-radius:2px;
      outline:none;
      resize:none;
      border:none;
      overflow-y:hidden;
      font-size:14px;
      font-family:'Microsoft Yahei';
    }
		button.btn{
			height:100%;
			width:16%;
			background:#ccc;
			color:white;
			border-radius:2px;
			cursor:not-allowed;
      font-family:'Microsoft Yahei';
			&.enable{
				background:#1E90FF;
				cursor:pointer;
			}
		}
	}
	.other{
		display:flex;
		background:#eee;
		.item{
			height:100%;
			flex:1;
			text-align:center;
      line-height:32px;
			img{
				width:32px;
				height:32px;	
				margin-top:4px;
				cursor:pointer;
			}
		}
	}
}
</style>