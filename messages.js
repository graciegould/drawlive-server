// Importing express module
const express=require("express")
const router=express.Router()
  let  messages =[]
  const getMessages=async(m)=>{
    messages = m
  }
// Handling request using router
router.get("/",(req,res,next)=>{
    res.append('Access-Control-Allow-Origin', ['*'])
    res.send(messages)
})



// Importing the router
module.exports={router, getMessages, messages}