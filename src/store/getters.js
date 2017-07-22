export const userId = state => state.loginStatus.userId
export const isLogin = state => state.loginStatus.isLogin
export const userInfo = state => state.userInfo
export const accounts = state => state.accounts
export const hasGetAllMessage = state => state.message.hasGetAllMessage
export const allMessage = state => state.message.allMessage
export const hasGetFriendList = state => state.friend.hasGetFriendList
export const friendList = state => state.friend.friendList
export const hasGetNewFriends = state => state.friend.hasGetNewFriends
export const newFriends = state => state.friend.newFriends
export const isShowSideBar = state => state.sidebar.isShowSideBar
export const isInit = state => state.sidebar.isInit
export const isShowMask = state => state.sidebar.isShowMask