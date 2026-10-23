package com.aurelis.store.controller;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;
import java.nio.file.*;import java.util.*;
@RestController @RequestMapping("/api/products")
public class ProductController {
 private final ObjectMapper mapper; private final Path catalog;
 public ProductController(ObjectMapper mapper,@Value("${aurelis.root:..}") String root){this.mapper=mapper;this.catalog=Path.of(root,"catalog.json");}
 @GetMapping public Object products() throws Exception { return mapper.readValue(Files.readString(catalog),new TypeReference<List<Map<String,Object>>>(){}); }
}
