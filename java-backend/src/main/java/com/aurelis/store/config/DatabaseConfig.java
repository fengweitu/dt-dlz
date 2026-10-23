package com.aurelis.store.config;
import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.context.annotation.Configuration;
@Configuration
public class DatabaseConfig {
 private final JdbcTemplate jdbc;
 public DatabaseConfig(JdbcTemplate jdbc){this.jdbc=jdbc;}
 @PostConstruct public void migrate(){jdbc.execute("CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY)");}
}
