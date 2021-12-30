import { animate, state, style, transition, trigger } from '@angular/animations';
import { AfterViewChecked, ChangeDetectorRef, Component, HostBinding } from '@angular/core';
import {FormControl, Validators} from '@angular/forms';
import { HttpClient } from '@angular/common/http';

export interface Post{
  emoji:string;
  title:string;
  mediaType:string;
  mediaSource:string;
  content:string;
  color:string;
  postID:string;
  expDate:number;
  postDate:number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [
    trigger('fade',[
      state('void',style({opacity: 0})),
      transition('void => *',[animate(250)]),
      transition('* => void',[animate(250)]),
    ]),
  ]
})


export class AppComponent implements AfterViewChecked{
  //set initial post array,filter and youtube window size.
  //retrieve information from server
  constructor(private http: HttpClient,private cd:ChangeDetectorRef) { 
    this.allPosts=[]
    this.youtubeWidth=192;
    this.youtubeHeight=108;
    this.filteredPosts=[]
    this.loadInfo();
    
  }
  
  //change youtube window size every time windowsize is changed.
  ngAfterViewChecked(){
    var cardWidth = document.getElementById("input-card")?.clientWidth
    if(cardWidth != undefined){
      this.youtubeWidth = cardWidth-5
      this.youtubeHeight = cardWidth/16*9
    }
    this.cd.detectChanges();
  }

  //title
  title = "emoji-notes-angular"
  
  //variable current user information
  currentUserColor = "#" + Math.floor(Math.random()*16777215).toString(16)

  //variable for loading
  loading = true;

  //variable for allposts retrieved from workers
  allPosts:Post[];

  //variables for filtering posts
  filteredPosts:Post[];
  filterToggled = false;
  emojiFilter = "";
  
  //handle youtube window size
  youtubeWidth:number;
  youtubeHeight:number;
  
  //variables for new post inputs
  toggled: boolean = false;
  selected = "📌";
  titleControl = new FormControl("",[Validators.required]);
  mediaSelection = ""
  mediaControl = new FormControl("",[]);
  contentControl = new FormControl("",[Validators.required]);
  expDateControl = new FormControl("",[]);
  
  //handle dark mode
  isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  //retrieve post info from cloudflare workers
  loadInfo(){
    this.loading = true;
    this.http.get(serverURL)
    .subscribe(data=>{
      this.allPosts = <Post[]> data
      this.applyFilter()
      this.loading = false;
    })
  }
  
  //handle dark mode
  @HostBinding('class')
  get themeMode(){
    return this.isDark ? "dark-theme" : "light-theme";
  }
  
  //apply post filtering according to selected emoji
  applyFilter(){
    if (this.emojiFilter === ""){this.filteredPosts = this.allPosts;return;}
    this.filteredPosts = [];
    for(var i in this.allPosts){
      if(this.allPosts[i].emoji == this.emojiFilter){
        this.filteredPosts.push(this.allPosts[i])
      }
    }
  }

  //handle emoji selection for filter
  handleEmojiFilter(event: { char: string; label:string;}) {
    this.emojiFilter = event.char;
    this.filterToggled = false;
    this.applyFilter()
  }

  //handle emoji selection for inputs
  handleEmojiSelection(event: { char: string; label:string;}) {
    this.selected = event.char;
    this.toggled = false;
  }
  
  minDate = new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+1);
  //handle submission
  handleSubmission(){
    this.minDate = new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()+1);
    this.loading = true;
    if(!this.titleControl.valid){this.titleControl.markAsTouched()}
    if(!this.contentControl.valid){this.contentControl.markAsTouched()}
    if(!this.expDateControl.valid){this.expDateControl.markAsTouched()}

    if(!(this.titleControl.valid && this.contentControl.valid && this.expDateControl.valid)){
      this.loading = false;
      return;
    }

    let media = "";
    let source = "";



    let now = Date.now();
    var newPost:Post = {
      emoji:this.selected,
      title: this.titleControl.value, 
      content: this.contentControl.value, 
      color: this.currentUserColor,
      mediaType:media,
      mediaSource:source,
      postDate:now,
      postID:now+uuidv4(),
      expDate:0,
    }
    if(this.mediaControl.value!=null && this.mediaControl.value!=""){
      console.log(this.mediaControl.value)
      let ytRe = new RegExp("((https://www.youtube.com/watch\\?v=)|(https://youtu.be/))(.{11})");
      if(ytRe.test(this.mediaControl.value)){
        newPost.mediaType = "Youtube"
        newPost.mediaSource = this.mediaControl.value.match(ytRe)[4]
      }else{
        if(this.mediaControl.value.match(/\.(jpeg|jpg|gif|png|mp4)$/) != null){
          newPost.mediaType = "Image"
          newPost.mediaSource = this.mediaControl.value.replace(".mp4",".gif")
        }else{
          newPost.mediaType = "Link"
          newPost.mediaSource = this.mediaControl.value
        }
      }
    }
    if(this.expDateControl.value != ""){
      newPost['expDate'] = (new Date(this.expDateControl.value)).getTime()
    }
    console.log(newPost)

    this.titleControl.reset()
    this.mediaSelection = ""
    this.mediaControl.reset()
    this.contentControl.reset()
    this.expDateControl.reset()

    this.http.post(serverURL,newPost).subscribe((data)=>{
      this.allPosts.push(<Post>data)
      this.applyFilter()
      this.loading = false
    })
    this.currentUserColor = "#" + Math.floor(Math.random()*16777215).toString(16)
  }

  //handle post removal
  handleRemove(i:number){
    this.loading = true;
    this.http.delete(serverURL,{body:this.filteredPosts[i]["postID"]}).subscribe((data)=>{
      var postIndex =getPostIndex(this.allPosts,<String>data)
      this.allPosts.splice(postIndex,1)
      this.applyFilter()
      this.loading = false;
    })
  }

  //generate readable date string from UTC
  UTCtoString(date:number){
    var d = new Date(date)
    return d.toLocaleDateString() + " " +  d.toLocaleTimeString()
  }
}

//Helper variables and functions
var serverURL = "https://emojinotes.sj78sj78.workers.dev"

//get first index of a given post in the post array
function getPostIndex(arr:Post[],postID:String){
  for(var i:number = 0;i<arr.length;i++){
    if(arr[i]['postID'] == postID){
      return i
    }
  }
  return -1
}

//generate UUIDv4 for unique key
function uuidv4(): string {
  return (''+[1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, ch => {
      let c = Number(ch);
      return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    }
  )
}