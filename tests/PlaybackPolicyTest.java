import com.netshow.app.PlaybackPolicy;import java.util.*;
public class PlaybackPolicyTest{
 public static void main(String[] args){
  PlaybackPolicy policy=new PlaybackPolicy(Arrays.asList("doubleclick.net","popads.net"));
  for(String url:Arrays.asList("https://doubleclick.net/ad","https://nested.doubleclick.net/ad","https://DOUBLECLICK.NET./ad"))if(!policy.blocks(url))throw new AssertionError(url);
  for(String url:Arrays.asList("https://notdoubleclick.net/movie","https://doubleclick.net.example.org/movie","https://media.example.com/video.m3u8","blob:https://player.cinezo.live/id"))if(policy.blocks(url))throw new AssertionError(url);
  for(String url:Arrays.asList("https://vidsrc.mov/embed/movie/1","https://player.cinezo.live/embed/tv/1/1/1"))if(!PlaybackPolicy.allowedPage(url))throw new AssertionError(url);
  for(String url:Arrays.asList("https://vidsrc.mov.evil.com/","https://user@vidsrc.mov/","intent://ad","http://vidsrc.mov/","https://vidsrc.mov:444/"))if(PlaybackPolicy.allowedPage(url))throw new AssertionError(url);
  for(String host:Arrays.asList("vidsrc.mov","mov","vercel.app","localhost","a.supabase.co","https://ads.com")){try{new PlaybackPolicy(Arrays.asList(host));throw new AssertionError(host);}catch(IllegalArgumentException expected){}}
  System.out.println("Playback policy tests passed");
 }
}
