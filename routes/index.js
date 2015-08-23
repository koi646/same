var express = require('express');
var router = express.Router();
var superagent = require('superagent');
// var cheerio = require('cheerio');

var mongoose = require('mongoose');
var redis = require('redis');
var config = require('./config.js');
var db = mongoose.connect('mongodb://localhost/same');
//设置代理
require('superagent-proxy')(superagent);
var proxys = ['http://115.239.210.166:80','http://202.121.32.63:80','http://111.13.12.163:80','http://121.40.71.207','http://104.131.83.39'];
var proxy = proxys[4];
var redis = redis.createClient(6379,'127.0.0.1');
// redis.hmset('mugou',{"200":"lsl",qingting:321},function(err){console.log(err);console.log('---')});
// redis.hset('mugou',"200",function(err,res){console.log(res,'存进去了')});	
//初始化redis
// redis.lpush('Userid_arr',JSON.stringify({"id":4269479}));
// redis.lpush('Channelid_arr',JSON.stringify({"id": 1033563}));
redis.sadd('Userid_arr',JSON.stringify({"id":4323234}));
redis.sadd('Channelid_arr',JSON.stringify({"id": 1057515}));
// 创建视图
var Schema = mongoose.Schema;
var Users = new Schema({
	id: Number,
	username: String,
	avatar: String,
	created_at: Number,
	is_staff: Number,  //1是工作管理员 0不是
	timezone: String, //时区
});
var Channels = new Schema({
	id: Number,
	name: String,
	icon: String,
	cate: Number, //1是文字 2是图文 3音乐 4视频
	user_id: Number
});
// 注册model
mongoose.model('user',Users);
mongoose.model('channel',Channels);
// 创建模型
var User = mongoose.model('user'),
	Channel = mongoose.model('channel');
var Crawl={
	host : "https://v2.same.com",
	crawl_user : function(callback){
		var self = this;
		// var obj = self.Channel_id.shift();
		redis.spop('Channelid_arr',function(err,obj){
			if (err) {console.log(err);}
			if (!obj) {
				return ;
			}
			obj = JSON.parse(obj);
			var url;var result;
			if (obj.next){
				url = self.host + obj.next;
			}else{
				url = self.host + '/channel/' + obj.id + '/senses';
			}	
			superagent.get(url)
				.set(config.header)
				.proxy(proxy)
				.end(function(err,res){					
					if (err) {console.log(err);}
					res.text = JSON.parse(res.text);
					var data = res.text.data;
					if (data.next){
						//推入channel_id队列中 下次继续爬
						obj.next = data.next;
						redis.sadd("Channelid_arr",JSON.stringify(obj));
					}
				  	//对数据库和队列操作
				  	//爬完后存入hash
				  	//与hash对比去重
				  	data.results.forEach(function(result,i){
				  		var user = result.user;
				  		redis.hget("Userid_hash",user.id,function(err,has){
				  			if (err) {console.log(err);}
				  			if (!has){
				  				redis.hset("Userid_hash",user.id,true);				  				
				  				console.log("push userid:",user.id,user.username);
				  				redis.sadd("Userid_arr",JSON.stringify({"id": user.id,"username":user.username}));
						  		var newUser = {
						  			id: user.id,
									username: user.username,
									avatar: user.avatar,
									created_at: user.created_at,
									is_staff: user.is_staff,  
									timezone: user.timezone,   			
						  		}

	  				  			//存入mongo upsert:true 如果没有就插入 有就更新
				  				User.update({id: user.id},newUser,{upsert:true},function(err,result){
				  				if (err) {
				  					console.log(err);
				  				}
				  			})
				  			}
				  		})
				  	})
	  				return self.crawl_user();
				});					  						  							 
		})
	},
	crawl_channel: function(callback){
		var self = this;
		// var obj = self.Channel_id.shift();
		redis.spop('Userid_arr',function(err,obj){
			if (err) {console.log(err);}
			if (!obj) {
				console.log("频道被爬完...");
				return ;
			}
			obj = JSON.parse(obj);
			var url;
			if (obj.next){
				url = self.host + obj.next;
			}else{
				url = self.host + '/user/' + obj.id + '/channels/write';
			}
			console.log('pop userid:',obj.id,obj.username);
			superagent.get(url)
				.set(config.header)
				.proxy(proxy)
				.end(function(err,res){					
					if (err) {console.log(err);}
					res.text = JSON.parse(res.text);
					var data = res.text.data;
					if (data.next){
						//推入channel_id队列中 下次继续爬
						obj.next = data.next;
						redis.sadd("Userid_arr",JSON.stringify(obj));
					}
				  	//对数据库和队列操作
				  	//爬完后存入hash
				  	//与hash对比去重
				  	data.writed_channels.forEach(function(result,i){
				  		var channel = result.channel;
				  		redis.hget("Channelid_hash",channel.id,function(err,has){
				  			if (err) {console.log(err);}
				  			if (!has){
				  				redis.hset("Channelid_hash",channel.id,true);
				  				console.log("channelid:",channel.id,"name:",channel.name);
				  				redis.sadd("Channelid_arr",JSON.stringify({"id": channel.id,"name": channel.name}));
				  				//存入mongo
				  				var newChannel = {
				  					id: channel.id,
				  					name: channel.name,
				  					icon: channel.icon,
				  					cate: channel.cate,
				  					user_id: channel.user_id
				  				}		

				  				Channel.update({id: channel.id },newChannel,{upsert: true},function(err,result){
				  					if (err) {
				  						console.log(err);
				  					}
				  				});			
				  			}			  			
				  		})
				  	})
				  	return self.crawl_channel();
				});					  						  							 

		})
	}
};
/* 爬user. */
router.get('/user', function(req, res, next) {
	console.log('开始爬取same...');
	//从第一个userId开始爬channel
	Crawl.crawl_user();
});
//爬channel
router.get('/channel',function(req,res,next){
	console.log("开始爬取频道..");
	Crawl.crawl_channel();
})

module.exports = router;

