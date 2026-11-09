package com.netshow.app;
import java.net.URI;
import java.util.*;
public final class PlaybackPolicy {
 private static final Set<String> PROVIDERS=new HashSet<>(Arrays.asList("cinesrc.st","player.cinezo.live","vidsrc.mov","vidlink.pro","vidsrc.sh"));
 private static final String[] RESERVED={"cinesrc.st","cinezo.live","vidsrc.mov","vidlink.pro","vidsrc.sh","dramatip.net","vercel.app","supabase.co","themoviedb.org","tmdb.org","trycloudflare.com","localhost"};
 private final Set<String> blocked=new HashSet<>();
 public PlaybackPolicy(Collection<String> hosts){
  if(hosts.size()>2000)throw new IllegalArgumentException("Too many blocking rules");
  for(String host:hosts){if(host==null||host.length()>253||!host.matches("([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z]{2,63}"))throw new IllegalArgumentException("Invalid blocking host");for(String safe:RESERVED)if(host.equals(safe)||host.endsWith("."+safe)||safe.endsWith("."+host))throw new IllegalArgumentException("Reserved blocking host");blocked.add(host);}
 }
 public boolean blocks(String raw){try{String host=new URI(raw).getHost();if(host==null)return false;host=host.toLowerCase(Locale.ROOT);while(host.endsWith("."))host=host.substring(0,host.length()-1);while(host.contains(".")){if(blocked.contains(host))return true;host=host.substring(host.indexOf('.')+1);}}catch(Exception ignored){}return false;}
 public static boolean allowedPage(String raw){try{URI u=new URI(raw);return "https".equalsIgnoreCase(u.getScheme())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)&&PROVIDERS.contains(u.getHost().toLowerCase(Locale.ROOT));}catch(Exception ignored){return false;}}
}
