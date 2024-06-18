const express = require('express');
const errorhandler = require('express-async-handler');
const bodyParser = require('body-parser');
const compression = require('compression');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const zlib = require('zlib');
//const Fluoresce = require('fluoresce');
process.on('uncaughtException', function (error) {
   console.log(error.stack);
   LogFile.write(error.stack + "\n");
});
var Forma = express();
let ServerConfig = {}
if (fs.existsSync('./config.json')) {
	ServerConfig = JSON.parse(fs.readFileSync('./config.json'));
}
else {
	ServerConfig = {
		'URL': "127.0.0.1",
		'Port': 9050,
		'PhotonURL': "127.0.0.1:9001",
		'StateURL': "",
		'AssetPass': "",
		'SSL': false,
		'Certs': {
			'key': "/path/to/key.pem",
			'cert': "/path/to/cert.pem",
			'ca': "/path/to/chain.pem"
		}
	}
	fs.writeFileSync('./config.json', JSON.stringify(ServerConfig, null, 2));
}
function GetDayBegin() {
	let Now = new Date();
	const BeginDay = new Date(Now.getFullYear(), Now.getMonth(), Now.getDate());
	return (BeginDay / 1000);
}
function GetDayNo() {
	let Now = new Date();
	const DateYear = String(Now.getFullYear()).slice(-2);
	const DateMonth = ("0" + String(Now.getMonth() + 1)).slice(-2);
	const DateDay = ("0" + String(Now.getDate())).slice(-2);
	const Formatted = parseInt(DateYear + DateMonth + DateDay);
	return Formatted;
}
function GetDayEnd() {
	let Now = new Date();
	const EndDay = new Date(Now.getFullYear(), Now.getMonth(), Now.getDate() + 1);
	return (EndDay / 1000);
}
function PrettyTime(TimeData) {
	const Hour = Math.floor(TimeData / 3600);
	const Min = Math.floor((TimeData % 3600) / 60);
	const Sec = Math.floor(TimeData % 60);
	let Time = "";
	if (Hour > 0) { Time += "" + Hour + ":" + (Min < 10 ? "0" : ""); }
	Time += "" + Min + ":" + (Sec < 10 ? "0" : "");
	Time += "" + Sec;
	return Time;
}
let LastServerReset = GetDayBegin();
let NextServerReset = 86400 - (Math.floor(Date.now() / 1000) - LastServerReset);
let DayEnd = GetDayEnd();
let DayNumber = GetDayNo();
function GetCurrentDate() {
	const date = new Date();
	return date.toUTCString();
}
const Passphrase = crypto.createHash('md5').update(String(Math.floor(Date.now() * Math.random() * 1000))).digest('hex');
fs.writeFileSync('./passphrase.txt', Passphrase + "\n");
let LogFile = fs.createWriteStream('./Library/Log/URL_' + LastServerReset + '.txt');
async function RecordManager(req, res, next) {
	LogFile.write(req.url + "\n");
	res.locals.ResponseBody = {
		'error_code': 0,
		'message': {}
	}
	
	if (req.url.includes("/../")) { res.end(); return; }
	else if (req.url.includes("/utility/")) {
		if (req.get('passphrase') != Passphrase) { res.end("Denied.\n"); return; }
		next();
		return;
	}

	next();
}

let AssetList = JSON.parse(fs.readFileSync('./Library/Event/AssetList.json'));
const ConsentView = fs.readFileSync('./Library/Function/Consent/View');
const ConsentApply = fs.readFileSync('./Library/Function/Consent/Apply');

Forma.use(bodyParser.json({ type: ['application/json'], limit: "6mb" }));
Forma.use(compression());
Forma.use(express.static('static'));
Forma.use(RecordManager);
Forma.disable('x-powered-by');
let server = {};
if (ServerConfig['SSL'] == true) {
	server = https.createServer({
			key: fs.readFileSync(ServerConfig['Certs']['key']),
			cert: fs.readFileSync(ServerConfig['Certs']['cert']),
			ca: fs.readFileSync(ServerConfig['Certs']['ca'])
		}, Forma).listen(ServerConfig['Port'], function() {
		console.log("Forma online. Server passphrase is " + Passphrase);
	});	
}
else {
	server = http.createServer(Forma).listen(ServerConfig['Port'], function() {
		console.log("Forma online. Passphrase: " + Passphrase);
	});
}

// ----------------------- Start Consent/Privacy -------------------------------------
Forma.post("/api/chkApp", async (req, res) => {
	const Serialized = JSON.stringify({
		'message': "success",
		'status': 200
	});
	res.set({'content-type': "text/plain;charset=ISO-8859-1", 'content-length': Serialized.length});
	res.end(Serialized);
});
Forma.post("/npggm/service.do", async (req, res) => {
	const Serialized = "11603404";
	res.set({'content-type': "text/plain;charset=ISO-8859-1", 'content-length': Serialized.length});
	res.end(Serialized);
});
Forma.get("/api/v1/consent_infos", async (req, res) => {
	const Serialized = JSON.stringify({
		'errors': [
			"存在しないユーザです"
		],
		'ok': false
	});
	res.set({'content-type': "application/json", 'content-length': Serialized.length});
	res.status(404);
	res.end(Serialized);
});
Forma.post("/api/v1/consent/request", async (req, res) => {
	const Serialized = JSON.stringify({
		'ok': true,
		'results': {
			'url': "https://" + ServerConfig['URL'] + "/api/v1/consent/view"
		}
	});
	res.set({'content-type': "application/json", 'content-length': Serialized.length});
	res.end(Serialized);
});
Forma.get("/api/v1/consent/view", async (req, res) => {
	res.set({'content-type': 'text/html', 'content-length': ConsentApply.length});
	res.end(ConsentApply);
});
Forma.post("/api/v1/consent/apply", async (req, res) => {
	res.set({'content-type': 'text/html', 'content-length': ConsentApply.length});
	res.end(ConsentApply);
});
// ----------------------- End Consent/Privacy ---------------------------------------

Forma.post("/game_server/api/versions/info", errorhandler(async (req, res, next) => {
	const PlatformID = parseInt(req.get("x-inu-application-platform"));
	let UpdateURL = "https://play.google.com/store/apps/details?id=com.bandainamcoent.torays";
	if (PlatformID == 1) {
		UpdateURL = "https://itunes.apple.com/jp/app/teiruzu-obu-za-reizu/id1113231866?mt=8";
	}
	res.locals.ResponseBody['message'] = {
		'asset_bundle_directory': AssetList['Manifest'],
		'asset_version': 2,
		'platform_type': PlatformID,
		'proto_ver': req.body['proto_ver'],
		's3_url': "https://cdn-production-cf.toco.tales-ch.jp",
		'server_url': "https://" + ServerConfig['URL'],
		'update_url': UpdateURL
	};
	next();
}));
Forma.post("/game_server/api/maintenances/check", async (req, res, next) => {
	next();
});
Forma.post("/game_server/api/tutorial_befores/analyze", async (req, res, next) => {
	next();
});

Forma.post("/game_server/api/users/prepare", errorhandler(async (req, res, next) => {
	const ChosenName = req.body['message']['name'];
	res.locals.ResponseBody['message'] = {
		'verify_id': crypto.randomUUID()
	}
	next();
}));
Forma.post("/game_server/api/users/create", errorhandler(async (req, res, next) => {
	//temporarily hardcode as 1
	const UserID = 1;
	res.locals.ResponseBody['message'] = {
		'friend_code': UserID,
		'password': Buffer.from(String(UserID * Math.floor(Date.now()))).toString('base64'),
		'user_id': UserID
	}
	next();
}));
Forma.post("/game_server/api/users/login", errorhandler(async (req, res, next) => {
	const UserID = req.body['message']['user_id'];
	const Password = req.body['message']['password'];
	res.locals.ResponseBody['message'] = {
		'battling_mst_hard_tower_id': 0,
		'battling_mst_knockout_tower_id': 0,
		'battling_mst_tower_id': 0,
		'inquiry_parameter': {
			'delete_encrypt_key': "deletion_totr",
			'delete_link': "",
			'encrypt_key': "talesoftherays",
			'link': ""
		},
		'quest_current': {
			'ap_multiple_rate': 1,
			'continue_num': 0,
			'current_quest_id': 100011,
			'mst_agency_food_effect_ids': [],
			'old_quest_id': 100011,
			'overray_flag': false,
			'quest_flag': false,
			'support_lock_flag': false
		},
		'server_time': 1716437463,
		'user': {
			'advantage_item_use': null,
			'age': null,
			'ap': 45,
			'ap_max': 45,
			'ap_orb': 0,
			'ap_recovery_at': 1716437462,
			'auto_mirrorge_arte_reinforces': [
				{
					'mirrorge_type': 0,
					'num': 0,
					'rank': 0
				},
				{
					'mirrorge_type': 1001,
					'num': 0,
					'rank': 0
				},
				{
					'mirrorge_type': 1002,
					'num': 0,
					'rank': 0
				},
				{
					'mirrorge_type': 1003,
					'num': 0,
					'rank': 0
				},
				{
					'mirrorge_type': 1004,
					'num': 0,
					'rank': 0
				},
				{
					'mirrorge_type': 1005,
					'num': 0,
					'rank': 0
				},
				{
					'mirrorge_type': 1006,
					'num': 0,
					'rank': 0
				},
				{
					'mirrorge_type': 1007,
					'num': 0,
					'rank': 0
				}
			],
			'birthday': null,
			'bnid_combine': false,
			'chara_buff': {
				'cc': 0,
				'critical': 0,
				'hp': 0,
				'm_attack': 0,
				'p_attack': 0
			},
			'created_at': 1716437461,
			'diamond': 890000,
			'equip_awake_statuses': null,
			'fragment': 0,
			'friend_code': 122322047,
			'friend_point': 0,
			'gald': 1098765,
			'jewel': 9000000,
			'jewel_free': 0,
			'jewel_pay': 9000000,
			'knockout_tower_point': 0,
			'last_login_at': 1716437462,
			'message': "よろしくお願いします！",
			'mst_honor_id': 1,
			'name': "Yure",
			'overray': 4,
			'overray_max': 4,
			'overray_recovery_at': 1716437462,
			'passport_expired_at': 915148800,
			'prism': 89000,
			'scenario_part': 1,
			'tower_point': 0,
			'tutorial_flag': false,
			'tutorial_phase': 4111,
			'user_voice_packs': []
		}
	}
	next();
}));

Forma.post("/game_server/api/fav_chara/list", async (req, res, next) => {
	res.locals.ResponseBody['message'] = {
		'fav_charas': [
			{
				'mst_fav_chara_id': 34,
				'rewards': [
					{
						'position': 1,
						'reward_num': 1,
						'reward_type': 10,
						'reward_value': 3410002
					},
					{
						'position': 2,
						'reward_num': 1,
						'reward_type': 10,
						'reward_value': 3410001
					},
					{
						'position': 1,
						'reward_num': 1,
						'reward_type': 9,
						'reward_value': 345001
					},
					{
						'position': 2,
						'reward_num': 1,
						'reward_type': 9,
						'reward_value': 344001
					},
					{
						'position': 3,
						'reward_num': 1,
						'reward_type': 9,
						'reward_value': 344002
					},
					{
						'position': 4,
						'reward_num': 1,
						'reward_type': 9,
						'reward_value': 343002
					}
				]
			}
		]
	}
	next();
})
Forma.post("/game_server/api/users/status", async (req, res, next) => {
	res.locals.ResponseBody['message'] = {
		'advantage_item_use': null,
		'age': null,
		'ap': 45,
		'ap_max': 45,
		'ap_orb': 0,
		'ap_recovery_at': 1716437462,
		'auto_mirrorge_arte_reinforces': [
			{
				'mirrorge_type': 0,
				'num': 0,
				'rank': 0
			},
			{
				'mirrorge_type': 1001,
				'num': 0,
				'rank': 0
			},
			{
				'mirrorge_type': 1002,
				'num': 0,
				'rank': 0
			},
			{
				'mirrorge_type': 1003,
				'num': 0,
				'rank': 0
			},
			{
				'mirrorge_type': 1004,
				'num': 0,
				'rank': 0
			},
			{
				'mirrorge_type': 1005,
				'num': 0,
				'rank': 0
			},
			{
				'mirrorge_type': 1006,
				'num': 0,
				'rank': 0
			},
			{
				'mirrorge_type': 1007,
				'num': 0,
				'rank': 0
			}
		],
		'birthday': null,
		'bnid_combine': false,
		'chara_buff': {
			'cc': 0,
			'critical': 0,
			'hp': 0,
			'm_attack': 0,
			'p_attack': 0
		},
		'created_at': 1716437461,
		'diamond': 890000,
		'equip_awake_statuses': null,
		'fragment': 0,
		'friend_code': 122322047,
		'friend_point': 0,
		'gald': 1098765,
		'jewel': 9000000,
		'jewel_free': 0,
		'jewel_pay': 9000000,
		'knockout_tower_point': 0,
		'last_login_at': 1716437462,
		'message': "よろしくお願いします！",
		'mst_honor_id': 1,
		'name': "Yure",
		'overray': 4,
		'overray_max': 4,
		'overray_recovery_at': 1716437462,
		'passport_expired_at': 915148800,
		'prism': 89000,
		'scenario_part': 1,
		'tower_point': 0,
		'tutorial_flag': false,
		'tutorial_phase': 4111,
		'user_voice_packs': []
	}
	next();
});
Forma.post("/game_server/api/bridges/index", async (req, res, next) => {
	res.locals.ResponseBody['message'] = {
		'server_time': Math.floor(Date.now() / 1000),
		'login_bonus': [],
		'banners': [
			{
				'banner_image_path': "public/uploads/banners/24052199/24052101.png",
				'sort': 201,
				'destination_type': 1,
				'destination': "24052199"
			}
		],
		'present_count': 0,
		'latest_announce_update_at': Math.floor(Date.now() / 1000) - 10,
		'latest_follower_at': Math.floor(Date.now() / 1000) - 10,
		'mission_reward_flag': false,
		'friend_point_num': 0,
		'bridge_party': {},
		'campaign_menu': {
			'reinforce': {
				'mst_campaign_id': 0,
				'end_time': 0
			},
			'jewel_shop': {
				'mst_campaign_id': 0,
				'end_time': 0
			},
			'jewel_offer': {},
			'quests': [
				{
					"mst_campaign_id": 101,
					"start_date": 1716354000,
					"end_date": 1721746799
				}
			],
			'room_bonus': false
		},
		'game_mission_progresses': [],
		'collection_mission_complete_num': 0,
		'passport_disable_flag': false
	}
	next();
});
Forma.post("/game_server/api/agencies/status", async (req, res, next) => {
	res.locals.ResponseBody['message'] = {
		'user_agency_offers': [],
		'food_effect': {
			'success_type': 1,
			'mst_agency_food_id': 0,
			'mst_agency_food_effect_ids': [],
			'remain_count': 0
		}
	}
	next();
});

function ResHeaders(DataLength) {
	const Headers = { 
		'content-type': 'application/json',
		'content-length': DataLength
	}
	return Headers;
}
async function FinalizeResponse(req, res, next) {
	const Serialized = JSON.stringify(res.locals.ResponseBody);
	res.set(ResHeaders(Serialized.length));
	res.end(Serialized);
}
Forma.use(FinalizeResponse);